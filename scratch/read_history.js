const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logPath = 'C:\\Users\\anikh\\.gemini\\antigravity\\brain\\2e6de86d-253f-408b-9652-8a24b44e1501\\.system_generated\\logs\\transcript.jsonl';

async function read() {
  if (!fs.existsSync(logPath)) {
    console.log('Log file does not exist at:', logPath);
    return;
  }
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const modifiedFiles = new Set();
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'replace_file_content' || tc.name === 'write_to_file' || tc.name === 'multi_replace_file_content') {
            const args = JSON.parse(tc.arguments);
            if (args.TargetFile) {
              modifiedFiles.add(args.TargetFile);
            }
          }
        }
      }
    } catch (e) {
      // skip invalid JSON lines
    }
  }

  console.log('All files modified in this conversation:');
  modifiedFiles.forEach(f => console.log('-', f));
}

read();
