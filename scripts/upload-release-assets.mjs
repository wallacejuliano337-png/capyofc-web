import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const cred = execSync('git credential fill', {
  input: 'protocol=https\nhost=github.com\n',
  encoding: 'utf8',
});
const tokenMatch = cred.match(/password=([^\r\n]+)/);
if (!tokenMatch) {
  console.error('No token found');
  process.exit(1);
}
const token = tokenMatch[1];
const releaseId = 426682756;
const releaseDir = path.resolve('release');

const filesToUpload = [
  { name: 'Capy.ofc-Setup-0.1.3.exe', type: 'application/octet-stream' },
  { name: 'latest.yml', type: 'text/yaml' },
];

for (const f of filesToUpload) {
  const filePath = path.join(releaseDir, f.name);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  const stat = fs.statSync(filePath);
  console.log(`Uploading ${f.name} (${(stat.size / 1024 / 1024).toFixed(2)} MB)...`);

  const fileData = fs.readFileSync(filePath);
  const uploadUrl = `https://uploads.github.com/repos/wallacejuliano337-png/capyofc-releases/releases/${releaseId}/assets?name=${encodeURIComponent(f.name)}`;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'CapyChat-Publisher',
      'Content-Type': f.type,
      'Content-Length': String(stat.size),
    },
    body: fileData,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to upload ${f.name}: ${res.status} ${res.statusText}\n${text}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`Successfully uploaded ${f.name} (ID: ${data.id}, Size: ${data.size} bytes)`);
}

console.log('\nAll release assets successfully uploaded!');
