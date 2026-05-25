
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { messages } = body; 

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // System instruction passed via native Gemini 'system_instruction' param
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
      contents: messages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 256,
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(geminiRequestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API Error (Chat):', errorText);
        return new Response(JSON.stringify({ error: `API Error: ${response.statusText}`, detail: errorText }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I have nothing to say. Get back to work.";

    return new Response(JSON.stringify({ reply: replyText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Handler error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process chat request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
