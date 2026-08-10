import { authenticate } from './lib/auth.js';
import { checkRateLimit } from './lib/rate-limit.js';
import { validateChatMessages } from './lib/validate.js';
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
    const { messages } = body || {};

    // 3. Validate message shape
    const validation = validateChatMessages(messages);
    if (!validation.ok) {
      return edgeJson(400, { error: validation.error });
    }

    const systemInstruction = {
      parts: [{
        text: `You are a strict, demanding but ultimately educational IT Manager in a multinational company. 
The user is your employee. You must converse in English. 
Your goals:
1. Always stay in character as the Boss. Be demanding about deadlines, code quality, and professional communication.
2. If the user makes English grammar or vocabulary mistakes, correct them firmly but politely in your response before moving the conversation forward.
3. Keep responses relatively short (2-4 sentences max), resembling a real chat conversation.`
      }]
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const geminiRequestBody = {
      system_instruction: systemInstruction,
      contents: validation.messages,
      generationConfig: { temperature: 0.7, maxOutputTokens: 256 },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error (chat):', errorText);
      return edgeJson(502, { error: 'Upstream service error. Please try again.' });
    }

    const data = await response.json();
    const replyText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I have nothing to say. Get back to work.";

    return edgeJson(200, { reply: replyText });
  } catch (error) {
    console.error('Handler error (chat):', error.message);
    return edgeJson(500, { error: 'Internal Server Error' });
  }
}
