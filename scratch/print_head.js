const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\anikh\\.gemini\\antigravity\\brain\\2e6de86d-253f-408b-9652-8a24b44e1501\\.system_generated\\logs\\transcript.jsonl';

async function run() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  for await (const line of rl) {
    if (count < 20) {
      console.log(`Line ${count + 1}:`, line.substring(0, 150));
      count++;
    } else {
      break;
    }
  }
}

run();
