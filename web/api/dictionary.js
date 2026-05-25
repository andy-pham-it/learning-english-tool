
export const maxDuration = 60;

export default async function handler(req, res) {
  console.log('--- Dictionary Request Started (Node.js Runtime) ---');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY is missing.');
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }
  
  console.log(`Using API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);

  try {
    const { word } = req.body;
    console.log(`Processing word: "${word}"`);

    if (!word) {
      console.warn('Word is missing in request body');
      return res.status(400).json({ error: 'Word is required' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
    console.log('Calling Gemini 3.1 Flash Lite Preview API...');

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
Return ONLY the raw JSON object.`;

    const geminiRequestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API Error:', errorText);
        return res.status(response.status).json({ error: `Gemini Error: ${response.statusText}`, detail: errorText });
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    let resultText = parts.map(p => p.text).join('').trim();
    
    if (!resultText) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    console.log('Raw AI Response length:', resultText.length);

    // Robust JSON extraction: Find the first '{' and the last '}'
    const firstBrace = resultText.indexOf('{');
    const lastBrace = resultText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      resultText = resultText.substring(firstBrace, lastBrace + 1);
    }

    try {
      const parsed = JSON.parse(resultText);
      console.log('Successfully generated and parsed definition');
      return res.status(200).json(parsed);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError.message);
      console.error('Attempted to parse:', resultText);
      return res.status(500).json({ error: 'AI returned invalid JSON structure', detail: parseError.message });
    }

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
