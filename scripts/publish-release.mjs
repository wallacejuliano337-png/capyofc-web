import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const tag = `v${version}`;
const owner = 'wallacejuliano337-png';
const repo = 'capyofc-releases';

console.log(`\n========================================`);
console.log(`CAPYCHAT ‚Äî PUBLICA√á√ÉO OFICIAL NO GITHUB`);
console.log(`Vers√£o: ${tag}`);
console.log(`Reposit√≥rio: ${owner}/${repo}`);
console.log(`========================================\n`);

// 1. Obter credencial de forma segura
let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  try {
    const cred = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n',
      encoding: 'utf8',
    });
    const match = cred.match(/password=([^\r\n]+)/);
    if (match) {
      token = match[1];
    }
  } catch (err) {
    console.error('Erro ao consultar git credential:', err.message);
  }
}

if (!token) {
  console.error('[ERRO] Nenhuma credencial encontrada no ambiente ou git credential.');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  'User-Agent': 'CapyChat-Publisher',
  Accept: 'application/vnd.github+json',
};

// 2. Verificar se a tag/release j√° existe
console.log(`1. Consultando releases existentes em ${owner}/${repo}...`);
const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers });
if (!listRes.ok) {
  console.error(`Erro ao listar releases: ${listRes.status} ${listRes.statusText}`);
  process.exit(1);
}
const existingReleases = await listRes.json();
const found = existingReleases.find((r) => r.tag_name === tag);
if (found) {
  console.error(`[INTERROMPIDO] A release com tag '${tag}' (ID ${found.id}) j√° existe no reposit√≥rio!`);
  console.error(`Para evitar sobrescrever releases publicadas, a opera√ß√£o foi interrompida.`);
  process.exit(1);
}
console.log(`[OK] Nenhuma release pr√©-existente para '${tag}'. Prosseguindo.`);

// 3. Verificar artefatos locais
const releaseDir = path.join(root, 'release');
const filesToUpload = [
  { name: `Capy.ofc-Setup-${version}.exe`, type: 'application/octet-stream' },
  { name: `Capy.ofc-Setup-${version}.exe.blockmap`, type: 'application/octet-stream' },
  { name: 'latest.yml', type: 'text/yaml' },
];

for (const f of filesToUpload) {
  const fp = path.join(releaseDir, f.name);
  if (!fs.existsSync(fp)) {
    console.error(`[ERRO] Arquivo obrigat√≥rio n√£o encontrado: ${fp}`);
    process.exit(1);
  }
  const stat = fs.statSync(fp);
  console.log(`[OK] Artefato pronto: ${f.name} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
}

// 4. Criar release no GitHub como DRAFT inicialmente
console.log(`\n2. Criando release ${tag} no GitHub...`);
const releaseNotes = `## O que h· de novo no Capy.ofc v${version}

- **SeleÁ„o e Altern‚ncia entre M˙ltiplas Telas Compartilhadas**: quando dois ou mais participantes transmitem tela simultaneamente, agora È possÌvel selecionar e alternar livremente entre as transmissıes no palco principal.
- **Miniaturas de VÌdeo em Tempo Real**: visualizaÁ„o em tempo real de cada tela ativa na faixa inferior com indicadores de status ASSISTINDO e AO VIVO.
- **Fallback Autom·tico e Inteligente**: se uma transmiss„o for encerrada pelo transmissor, o palco seleciona automaticamente outra tela ativa remanescente.
- **Estabilidade WebRTC e Isolamento de Listeners**: tratamento robusto de eventos de vÌdeo sem interferÍncia entre componentes e serviÁo de voz.
`;

const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
  method: 'POST',
  headers: {
    ...headers,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    tag_name: tag,
    target_commitish: 'main',
    name: version,
    body: releaseNotes,
    draft: true,
    prerelease: false,
  }),
});

if (!createRes.ok) {
  const errText = await createRes.text();
  console.error(`Falha ao criar release: ${createRes.status} ${createRes.statusText}\n${errText}`);
  process.exit(1);
}

const release = await createRes.json();
console.log(`[OK] Release rascunho criada com sucesso (ID: ${release.id})`);

// 5. Fazer upload dos artefatos
console.log(`\n3. Enviando artefatos para a release ${release.id}...`);
for (const f of filesToUpload) {
  const fp = path.join(releaseDir, f.name);
  const stat = fs.statSync(fp);
  const sizeMb = (stat.size / 1024 / 1024).toFixed(2);
  console.log(`Enviando ${f.name} (${sizeMb} MB)...`);

  const fileData = fs.readFileSync(fp);
  const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(f.name)}`;

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'CapyChat-Publisher',
      'Content-Type': f.type,
      'Content-Length': String(stat.size),
    },
    body: fileData,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    console.error(`[FALHA] Erro ao enviar ${f.name}: ${uploadRes.status} ${uploadRes.statusText}\n${errText}`);
    process.exit(1);
  }

  const assetData = await uploadRes.json();
  console.log(`[CONCLU√çDO] ${f.name} enviado com sucesso! Asset ID: ${assetData.id}`);
}

// 6. Publicar a release (draft = false)
console.log(`\n4. Publicando a release oficialmente...`);
const pubRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${release.id}`, {
  method: 'PATCH',
  headers: {
    ...headers,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    draft: false,
  }),
});

if (!pubRes.ok) {
  const errText = await pubRes.text();
  console.error(`Falha ao publicar release: ${pubRes.status} ${pubRes.statusText}\n${errText}`);
  process.exit(1);
}

const finalRelease = await pubRes.json();
console.log(`\n========================================`);
console.log(`[SUCESSO] Vers√£o ${tag} publicada oficialmente!`);
console.log(`URL da Release: ${finalRelease.html_url}`);
console.log(`Total de assets vinculados: ${finalRelease.assets.length}`);
for (const a of finalRelease.assets) {
  console.log(` - ${a.name} (${(a.size / 1024 / 1024).toFixed(2)} MB)`);
}
console.log(`========================================\n`);
