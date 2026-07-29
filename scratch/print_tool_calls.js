const fs = require('fs');
const logPath = 'C:\\Users\\anikh\\.gemini\\antigravity\\brain\\2e6de86d-253f-408b-9652-8a24b44e1501\\.system_generated\\logs\\transcript.jsonl';

const lines = fs.readFileSync(logPath, 'utf8').split('\n');
for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.type && (obj.type.includes('FILE') || obj.type.includes('WRITE') || obj.type.includes('REPLACE'))) {
      console.log('Step Type:', obj.type);
      console.log('Keys:', Object.keys(obj));
      if (obj.tool_calls) {
        console.log('Tool calls:', JSON.stringify(obj.tool_calls).substring(0, 300));
      }
      break;
    }
  } catch (e) {}
}
