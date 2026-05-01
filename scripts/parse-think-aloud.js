const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs', 'think-aloud-methodology');
const files = [
  'gemini-code-1777455071526.md',
  'gemini-code-1777455242278.md',
  'gemini-code-1777455454132.md',
  'gemini-code-1777455533696.md',
  'gemini-code-1777455755998.md'
];

let allData = [];
let currentId = 1;

files.forEach(file => {
  const content = fs.readFileSync(path.join(docsDir, file), 'utf8');
  const lines = content.split('\n');
  let currentCategory = 'General';
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Detect category
    if (line.startsWith('### ')) {
      currentCategory = line.replace('### ', '').split(':')[0].trim();
      i++;
      continue;
    }
    
    // Detect sample
    // Pattern: **1. Name:** "English"
    // *(Vietnamese)*
    const sampleMatch = line.match(/^\*\*(\d+)\.\s*(.*?):\*\*\s*"(.*?)"/);
    if (sampleMatch) {
      const vietnameseTitle = sampleMatch[2];
      const english = sampleMatch[3];
      i++;
      
      let vietnamese = '';
      if (lines[i] && lines[i].trim().startsWith('*(')) {
        vietnamese = lines[i].trim().replace(/^\*\(/, '').replace(/\)\*$/, '');
        i++;
      } else {
        vietnamese = vietnameseTitle;
      }
      
      let code = '';
      if (lines[i] && lines[i].trim().startsWith('```')) {
        i++;
        while (lines[i] && !lines[i].trim().startsWith('```')) {
          code += lines[i] + '\n';
          i++;
        }
        i++;
      }
      
      let context = '';
      if (lines[i] && lines[i].trim().startsWith('> **Ngữ cảnh:**')) {
        context = lines[i].trim().replace('> **Ngữ cảnh:**', '').trim();
        i++;
      }

      // Generate Template Pattern
      const template = english.replace(/"(.*?)"/g, '[Value]')
                              .replace(/interface\s+\w+/g, 'interface [Name]')
                              .replace(/const\s+\w+/g, 'const [Variable]')
                              .replace(/let\s+\w+/g, 'let [Variable]')
                              .replace(/useState\(.*?\)/g, 'useState([InitialValue])')
                              .replace(/\b[a-z0-9]+(?:[A-Z][a-z0-9]+)+\b/g, '[Variable]');

      // Generate Usage Explanation
      let usage = `Use this when you need to ${currentCategory.toLowerCase()} and want to communicate your thought process clearly.`;
      if (context) {
        usage = `Used in scenarios where: ${context}`;
      } else if (vietnameseTitle) {
        usage = `Sử dụng khi bạn cần thực hiện: ${vietnameseTitle}`;
      }

      allData.push({
        id: `ta-${currentId++}`,
        category: currentCategory,
        english,
        vietnamese,
        code: code.trim(),
        context,
        usage,
        template
      });
    } else {
      i++;
    }
  }
});

fs.writeFileSync(
  path.join(__dirname, '..', 'web', 'public', 'assets', 'data', 'think-aloud.json'),
  JSON.stringify(allData, null, 2)
);

console.log(`Successfully generated ${allData.length} samples.`);
