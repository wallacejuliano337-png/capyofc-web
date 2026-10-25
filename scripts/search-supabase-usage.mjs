import fs from 'fs';
import path from 'path';

function search(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') search(full);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
      const c = fs.readFileSync(full, 'utf8');
      if (c.includes("communities") || c.includes("community_members")) {
        console.log('Found in:', full);
      }
    }
  }
}

search('d:/LYC-Arena/src');
