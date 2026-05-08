const apiKey = 'AIzaSyDLwIla2Fr7Qk9zZj-_rXpBO1tohizgZGg';
const word = 'serendipity';
const model = 'gemini-flash-latest';

async function test() {
  console.log(`Testing model: ${model} with word: ${word}`);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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

  const body = {
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
    }
  };

  const startTime = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const duration = Date.now() - startTime;
    console.log(`Response Status: ${response.status} (${response.statusText})`);
    console.log(`Time taken: ${duration}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error Details:', errorText);
      return;
    }

    const data = await response.json();
    console.log('Response Content:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Fetch Error:', error);
  }
}

test();
