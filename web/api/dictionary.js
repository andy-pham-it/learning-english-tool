import { authenticate } from './lib/auth.js';
import { checkRateLimit } from './lib/rate-limit.js';
import { sanitizeWord } from './lib/validate.js';
import { nodeJson } from './lib/http.js';

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return nodeJson(res, 405, { error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured.');
    return nodeJson(res, 500, { error: 'Service is not configured.' });
  }

  // 1. Authenticate
  const user = await authenticate(req);
  if (!user) {
    return nodeJson(res, 401, { error: 'Unauthorized' });
  }

  // 2. Rate limit per user
  const rate = checkRateLimit(user.uid);
  if (!rate.allowed) {
    return nodeJson(res, 429, {
      error: 'Rate limit exceeded. Please try again later.',
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  try {
    const { word } = req.body || {};

    // 3. Validate / sanitize input
    const cleanWord = sanitizeWord(word);
    if (!cleanWord) {
      return nodeJson(res, 400, { error: 'word must be a string of 1-100 characters' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const prompt = `You are a professional English-Vietnamese dictionary.
Analyze the word: "${cleanWord}"

You MUST return a JSON object with this EXACT structure:
{
  "word": "${cleanWord}",
  "phonetic": "IPA pronunciation",
  "entries": [
    {
      "partOfSpeech": "noun/verb/adjective...",
      "definitions": [
        {
          "en": "concise english definition",
          "vi": "nghĩa tiếng Việt (MANDATORY)",
          "example": "example sentence",
          "exampleVi": "dịch ví dụ sang tiếng Việt"
        }
      ]
    }
  ],
  "collocations": [
    {
      "phrase": "common phrase or phrasal verb",
      "meaning": "Vietnamese meaning",
      "exampleEn": "english example",
      "exampleVi": "vietnamese example"
    }
  ]
}

CRITICAL: 
1. Translate all definitions and ALL examples into Vietnamese.
2. Provide at least 3-5 common collocations or phrasal verbs related to the word.
Return ONLY the raw JSON object.`;

    const geminiRequestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error (dictionary):', errorText);
      return nodeJson(res, 502, { error: 'Upstream service error. Please try again.' });
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    let resultText = parts.map((p) => p.text).join('').trim();

    if (!resultText) {
      return nodeJson(res, 502, { error: 'Upstream service returned no data.' });
    }

    // Robust JSON extraction: first '{' to last '}'
    const firstBrace = resultText.indexOf('{');
    const lastBrace = resultText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      resultText = resultText.substring(firstBrace, lastBrace + 1);
    }

    try {
      const parsed = JSON.parse(resultText);
      return nodeJson(res, 200, parsed);
    } catch (parseError) {
      console.error('Gemini returned invalid JSON (dictionary):', parseError.message);
      return nodeJson(res, 502, { error: 'Upstream service returned an invalid response.' });
    }
  } catch (error) {
    console.error('Handler error (dictionary):', error.message);
    return nodeJson(res, 500, { error: 'Internal Server Error' });
  }
}
