import fs from 'node:fs/promises';
import path from 'node:path';

// Parse arguments
const args = process.argv.slice(2);

function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  return index > -1 ? args[index + 1] : defaultValue;
}

const countToGenerate = parseInt(getArg('--count', '20'));
const topic = getArg('--topic', 'IT');
const level = getArg('--level', 'B2');
let outputFile = getArg('--out', '');

// Autogenerate filename if not provided (e.g., "Marketing", "B1" -> marketing_b1.json)
if (!outputFile) {
  const safeTopic = topic.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
  const safeLevel = level.toLowerCase();
  outputFile = `${safeTopic}_${safeLevel}.json`;
}

const outputPath = path.resolve(process.cwd(), 'web/public/assets/data', outputFile);

async function getExistingData() {
  try {
    const data = await fs.readFile(outputPath, 'utf-8');
    const existing = JSON.parse(data);
    return { existing, existingWords: existing.map(item => item.word) };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { existing: [], existingWords: [] };
    }
    throw err;
  }
}

async function generateData() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable is missing.');
    console.error('Usage: GEMINI_API_KEY=your_key node scripts/data-generator/generator.js [args]');
    process.exit(1);
  }

  const { existing, existingWords } = await getExistingData();

  let PROMPT = `
You are an English teacher generating vocabulary for a student at the ${level} level. 
The student works in the ${topic} industry.
Generate exactly ${countToGenerate} vocabulary items. Return ONLY a JSON array, no markdown formatting.
Each item must have the following structure:
{
  "id": "unique_string_id_like_uuid",
  "word": "The English word or phrase",
  "phonetic": "The IPA phonetic transcription",
  "meaning": "The Vietnamese meaning",
  "example": "An example sentence using the word in a ${topic} context",
  "category": "${topic}"
}
`;

  if (existingWords.length > 0) {
    PROMPT += `\nCRITICAL INSTRUCTION: DO NOT generate any of the following words, as the user already learned them: ${existingWords.join(', ')}. Please provide completely new words.`;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

  console.log(`Generating ${countToGenerate} new ${topic} (${level}) words using Gemini 3.1 Flash Lite...`);
  console.log(`Saving output to: ${outputPath}`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: PROMPT }]
        }],
        generationConfig: {
          response_mime_type: 'application/json'
        }
      })
    });

    if (!response.ok) {
        throw new Error(`API returned ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textContent) {
        throw new Error("Invalid response structure from Gemini API");
    }

    const parsedData = JSON.parse(textContent);
    const mergedData = [...existing, ...parsedData];

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(mergedData, null, 2), 'utf-8');
    
    console.log(`Successfully generated ${parsedData.length} NEW words!`);
    console.log(`The file now contains ${mergedData.length} words in total.`);

  } catch (error) {
    console.error('Failed to generate data:', error);
    process.exit(1);
  }
}

generateData();
