import { authenticate } from './lib/auth.js';
import { checkRateLimit } from './lib/rate-limit.js';
import { validateTts } from './lib/validate.js';
import { edgeJson } from './lib/http.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return edgeJson(405, { error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured.');
    return edgeJson(500, { error: 'Service is not configured.' });
  }

  // 1. Authenticate
  const user = await authenticate(req);
  if (!user) {
    return edgeJson(401, { error: 'Unauthorized' });
  }

  // 2. Rate limit per user
  const rate = checkRateLimit(user.uid);
  if (!rate.allowed) {
    return edgeJson(429, {
      error: 'Rate limit exceeded. Please try again later.',
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  try {
    const body = await req.json();

    // 3. Validate input (text length cap + voice whitelist)
    const validation = validateTts(body);
    if (!validation.ok) {
      return edgeJson(400, { error: validation.error });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const geminiRequestBody = {
      contents: [{ parts: [{ text: validation.text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: validation.voice },
          },
        },
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error (tts):', errorText);
      return edgeJson(502, { error: 'Upstream service error. Please try again.' });
    }

    const data = await response.json();
    const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return edgeJson(502, { error: 'Upstream service returned no audio.' });
    }

    return edgeJson(200, { audio: base64Audio });
  } catch (error) {
    console.error('Handler error (tts):', error.message);
    return edgeJson(500, { error: 'Internal Server Error' });
  }
}
