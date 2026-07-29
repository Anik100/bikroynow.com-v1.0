const fs = require('fs');
const logPath = 'C:\\Users\\anikh\\.gemini\\antigravity\\brain\\2e6de86d-253f-408b-9652-8a24b44e1501\\.system_generated\\logs\\transcript.jsonl';

const content = fs.readFileSync(logPath, 'utf8');
const regex = /"TargetFile"\s*:\s*"([^"]+)"/g;
let match;
const files = new Set();
while ((match = regex.exec(content)) !== null) {
  files.add(match[1]);
}

console.log('Modified files found via regex:');
files.forEach(f => console.log('-', f));
