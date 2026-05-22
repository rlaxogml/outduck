const fs = require('fs');
const path = require('path');

const logPath = "C:\\Users\\gkimt\\.gemini\\antigravity-ide\\brain\\6ead3c71-b8f2-4d71-bc83-924f58115007\\.system_generated\\logs\\transcript.jsonl";
const pagePath = "c:\\Users\\gkimt\\outduck\\app\\company\\page.tsx";
const outputPath = "c:\\Users\\gkimt\\outduck\\scratch\\recovered_page.tsx";

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

// Clean recursively for arrays/objects (like ReplacementChunks)
function cleanDeep(val) {
  if (typeof val === 'string') {
    return clean(val);
  } else if (Array.isArray(val)) {
    return val.map(cleanDeep);
  } else if (val && typeof val === 'object') {
    const cleaned = {};
    for (let k in val) {
      cleaned[k] = cleanDeep(val[k]);
    }
    return cleaned;
  }
  return val;
}

// Read clean page.tsx (committed version currently on disk)
let content = fs.readFileSync(pagePath, 'utf8');

const lines = fs.readFileSync(logPath, 'utf8').split('\n');

const edits = [];

// Parse transcript.jsonl and collect edits chronologically
lines.forEach((line, index) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    
    // Find PLANNER_RESPONSE steps before Step 232
    if (obj.step_index < 232 && obj.type === 'PLANNER_RESPONSE' && obj.tool_calls) {
      obj.tool_calls.forEach(tc => {
        const toolName = clean(tc.name);
        if ((toolName === 'replace_file_content' || toolName === 'multi_replace_file_content') && tc.args) {
          const targetFile = clean(tc.args.TargetFile);
          if (targetFile && targetFile.includes('page.tsx')) {
            const chunks = [];
            if (toolName === 'replace_file_content') {
              chunks.push({
                target: clean(tc.args.TargetContent),
                replacement: clean(tc.args.ReplacementContent),
                startLine: tc.args.StartLine,
                endLine: tc.args.EndLine
              });
            } else if (toolName === 'multi_replace_file_content' && tc.args.ReplacementChunks) {
              let rawChunks = tc.args.ReplacementChunks;
              if (typeof rawChunks === 'string') {
                rawChunks = JSON.parse(clean(rawChunks));
              }
              const cleanedChunks = cleanDeep(rawChunks);
              cleanedChunks.forEach(c => {
                chunks.push({
                  target: c.TargetContent,
                  replacement: c.ReplacementContent,
                  startLine: c.StartLine,
                  endLine: c.EndLine
                });
              });
            }
            edits.push({
              step: obj.step_index,
              instruction: clean(tc.args.Instruction),
              chunks: chunks
            });
          }
        }
      });
    }
  } catch (e) {
    console.error(`Line ${index} error:`, e.message);
  }
});

console.log(`Found ${edits.length} edits to replay.`);

// Replay edits in order
edits.forEach((edit, idx) => {
  console.log(`\nReplaying Edit #${idx + 1} (Step ${edit.step}): "${edit.instruction}"`);
  
  edit.chunks.forEach((chunk, chunkIdx) => {
    // Normalize newlines in target and replacement to avoid CR/LF issues
    const targetNormalized = chunk.target.replace(/\r\n/g, '\n');
    const replacementNormalized = chunk.replacement.replace(/\r\n/g, '\n');
    
    // Check if current content normalized has the target
    const contentNormalized = content.replace(/\r\n/g, '\n');
    
    if (contentNormalized.includes(targetNormalized)) {
      console.log(`  Chunk #${chunkIdx + 1}: Match found! Applying replacement...`);
      // Replace target in normalized content
      const index = contentNormalized.indexOf(targetNormalized);
      
      const before = contentNormalized.substring(0, index);
      const after = contentNormalized.substring(index + targetNormalized.length);
      content = before + replacementNormalized + after;
    } else {
      console.error(`  Chunk #${chunkIdx + 1}: FAILED to find match!`);
      console.error(`  Target (first 100 chars):`, JSON.stringify(targetNormalized.substring(0, 100)));
      
      // Let's dump target to a temp file for debugging
      fs.writeFileSync(`scratch/failed_target_step_${edit.step}_chunk_${chunkIdx + 1}.txt`, targetNormalized);
    }
  });
});

// Write to scratch output
fs.writeFileSync(outputPath, content, 'utf8');
console.log(`\nSaved recovered file to ${outputPath}`);
