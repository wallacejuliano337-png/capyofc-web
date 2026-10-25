const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') searchDir(full, pattern);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(full, 'utf8');
      if (pattern.test(content)) {
        console.log('Found in:', full);
        const lines = content.split('\n');
        lines.forEach((l, idx) => {
          if (pattern.test(l)) console.log('  L' + (idx+1) + ': ' + l.trim());
        });
      }
    }
  }
}

searchDir('d:/LYC-Arena/src', /Sair do Servidor|leaveServer|deleteServer/i);
