const fs = require('fs');
const logPath = 'C:\\Users\\anikh\\.gemini\\antigravity\\brain\\2e6de86d-253f-408b-9652-8a24b44e1501\\.system_generated\\logs\\transcript.jsonl';

const lines = fs.readFileSync(logPath, 'utf8').split('\n');
for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.type === 'CODE_ACTION' && obj.content.toLowerCase().includes('page.js')) {
      console.log('Step Index:', obj.step_index);
      console.log('Path in step:', obj.content.match(/to: ([^\n]+)/)?.[1]);
    }
  } catch (e) {}
}
