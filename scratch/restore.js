const fs = require('fs');
const path = require('path');

const logPath = "C:\\Users\\gkimt\\.gemini\\antigravity-ide\\brain\\6ead3c71-b8f2-4d71-bc83-924f58115007\\.system_generated\\logs\\transcript.jsonl";

// Helper to clean double-serialized strings
function clean(val) {
  if (typeof val === 'string') {
    let s = val.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      try {
        return JSON.parse(val);
      } catch (e) {
        return val.substring(1, val.length - 1);
      }
    }
  }
  return val;
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n');

lines.forEach((line, index) => {
  if (!line.trim()) return;
  try {
    const rawObj = JSON.parse(line);
    if (rawObj.step_index < 232 && rawObj.type === 'PLANNER_RESPONSE' && rawObj.tool_calls) {
      rawObj.tool_calls.forEach(tc => {
        if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
          const rawTargetFile = tc.args.TargetFile;
          const cleanedTargetFile = clean(rawTargetFile);
          const includesPage = cleanedTargetFile.includes('page.tsx');
          console.log(`Step ${rawObj.step_index} | Tool: ${tc.name} | Raw: ${JSON.stringify(rawTargetFile)} | Cleaned: ${JSON.stringify(cleanedTargetFile)} | Includes page.tsx: ${includesPage}`);
        }
      });
    }
  } catch (e) {
    //
  }
});
