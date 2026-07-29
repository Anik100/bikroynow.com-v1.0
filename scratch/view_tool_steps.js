const fs = require('fs');
const logPath = 'C:\\Users\\anikh\\.gemini\\antigravity\\brain\\2e6de86d-253f-408b-9652-8a24b44e1501\\.system_generated\\logs\\transcript.jsonl';

const lines = fs.readFileSync(logPath, 'utf8').split('\n');
const seenTypes = new Set();
for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    seenTypes.add(obj.type);
    if (obj.type && (obj.type.includes('WRITE') || obj.type.includes('REPLACE') || obj.type.includes('EDIT'))) {
      console.log('Type:', obj.type);
      console.log('Content preview:', obj.content ? obj.content.substring(0, 300) : 'none');
    }
  } catch (e) {}
}

console.log('All seen step types:', Array.from(seenTypes));
