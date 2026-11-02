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
console.log(`CAPYCHAT — PUBLICAÇÃO OFICIAL NO GITHUB`);
console.log(`Versão: ${tag}`);
console.log(`Repositório: ${owner}/${repo}`);
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

// 2. Verificar se a tag/release já existe
console.log(`1. Consultando releases existentes em ${owner}/${repo}...`);
const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers });
if (!listRes.ok) {
  console.error(`Erro ao listar releases: ${listRes.status} ${listRes.statusText}`);
  process.exit(1);
}
const existingReleases = await listRes.json();
const found = existingReleases.find((r) => r.tag_name === tag);
if (found) {
  console.error(`[INTERROMPIDO] A release com tag '${tag}' (ID ${found.id}) já existe no repositório!`);
  console.error(`Para evitar sobrescrever releases publicadas, a operação foi interrompida.`);
  process.exit(1);
}
console.log(`[OK] Nenhuma release pré-existente para '${tag}'. Prosseguindo.`);

// 3. Verificar artefatos locais
const releaseDir = path.join(root, 'release');
const filesToUpload = [
  { name: `Capy.ofc-Setup-${version}.exe`, type: 'application/octet-stream' },
  { name: `Capy.ofc-Setup-${version}.exe.blockmap`, type: 'application/octet-stream' },
  { name: 'latest.yml', type: 'text/yaml' },
];

const portableFile = `Capy.ofc-Portable-${version}.exe`;
if (fs.existsSync(path.join(releaseDir, portableFile))) {
  filesToUpload.push({ name: portableFile, type: 'application/octet-stream' });
}

for (const f of filesToUpload) {
  const fp = path.join(releaseDir, f.name);
  if (!fs.existsSync(fp)) {
    console.error(`[ERRO] Arquivo obrigatório não encontrado: ${fp}`);
    process.exit(1);
  }
  const stat = fs.statSync(fp);
  console.log(`[OK] Artefato pronto: ${f.name} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
}

// 4. Criar release no GitHub como DRAFT inicialmente
console.log(`\n2. Criando release ${tag} no GitHub...`);
const releaseNotes = `## O que há de novo no Capy.ofc v${version}

- **Correção Definitiva de Tela Preta no Compartilhamento de Tela**: resolução da inatividade de quadros do capturador que causava tela preta após 5 segundos (\`kVideoMuteTimeoutMs\`). Implementado keep-alive de framerate (mínimo 15 fps em Electron e Web), parametrização de sender WebRTC (\`degradationPreference: 'maintain-resolution'\`, bitrate de 3.5 Mbps) e mecanismo sob demanda de solicitação de Keyframe IDR (\`keyframe_request\`) entre espectadores e apresentador.
- **Sistema de Espectadores Estilo Discord ('Entrar na Transmissão' e 'Parar de Assistir')**: o palco de vídeo central não se abre mais compulsoriamente para os participantes quando alguém inicia uma transmissão. Os participantes permanecem na Grade com uma barra de 'Transmissões Disponíveis', podendo clicar livremente em 'Entrar na Transmissão' para assistir em destaque, ou 'Parar de Assistir' a qualquer momento para retornar à grade sem qualquer interrupção na conexão de voz.
- **Suporte a Transmissões Múltiplas Simultâneas**: os espectadores podem alternar livremente entre as telas dos apresentadores com abas de seleção direta no palco central.
- **Preservação Integral da Eliminação de Falsos Indicadores AO VIVO (v0.1.9)**: transceivers de vídeo mantidos em \`recvonly\` por padrão, validação restrita de sessões em \`activeSessions\`, e disparo ordenado de eventos \`share_start\` e \`share_stop\`.
- **Desativação de Throttling em Segundo Plano no Electron**: \`backgroundThrottling: false\` em webPreferences para evitar suspensão de decodificadores e renderizadores de vídeo WebRTC quando a janela é minimizada para a barra de tarefas.
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
    name: `Capy.ofc v${version}`,
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
  console.log(`[CONCLUÍDO] ${f.name} enviado com sucesso! Asset ID: ${assetData.id}`);
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
console.log(`[SUCESSO] Versão ${tag} publicada oficialmente!`);
console.log(`URL da Release: ${finalRelease.html_url}`);
console.log(`Total de assets vinculados: ${finalRelease.assets.length}`);
for (const a of finalRelease.assets) {
  console.log(` - ${a.name} (${(a.size / 1024 / 1024).toFixed(2)} MB)`);
}
console.log(`========================================\n`);
