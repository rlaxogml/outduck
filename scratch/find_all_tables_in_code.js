const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules' && file !== '.next') {
        getFiles(name, files);
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
        files.push(name);
      }
    }
  }
  return files;
}

const rootDir = path.join(__dirname, '..');
const files = getFiles(rootDir);
const tableSet = new Set();

const regex = /\.from\(['"]([^'"]+)['"]\)/g;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = regex.exec(content)) !== null) {
    tableSet.add(match[1]);
  }
}

console.log("ALL TABLES DETECTED IN CODEBASE:");
console.log(Array.from(tableSet));
