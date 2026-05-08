export const maxDuration = 60;
// export const runtime = 'edge';

export default async function handler(req) {
  console.log('--- Dictionary Request Started ---');
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY is missing in environment variables.');
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  console.log(`Using API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);

  try {
    const { word } = await req.json();
    console.log(`Processing word: "${word}"`);

    if (!word) {
      return new Response(JSON.stringify({ error: 'Word is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    console.log('Calling Gemini API...');

    const prompt = `You are a professional English-Vietnamese dictionary.
Analyze the word: "${word}"

You MUST return a JSON object with this EXACT structure:
{
  "word": "${word}",
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
Return ONLY the raw JSON object, no markdown formatting.`;

    const geminiRequestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequestBody)
    });

    console.log(`Gemini API Response Status: ${response.status}`);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API Error (Dictionary):', errorText);
        return new Response(JSON.stringify({ error: `Gemini Error: ${response.statusText}`, detail: errorText }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    const data = await response.json();
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      return new Response(JSON.stringify({ error: 'No response from AI' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Clean markdown code blocks if present
    resultText = resultText.replace(/```json\s?|\s?```/g, '').trim();

    return new Response(resultText, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
