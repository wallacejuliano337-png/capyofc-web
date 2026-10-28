import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;
const releaseDir = path.join(root, "release");

console.log(`\n========================================`);
console.log(`CAPYCHAT — VERIFICAÇÃO DE ARTEFATOS DIST`);
console.log(`Versão configurada: v${version}`);
console.log(`Diretório de saída: ${releaseDir}`);
console.log(`========================================\n`);

if (!fs.existsSync(releaseDir)) {
  console.error(`[ERRO] O diretório '${releaseDir}' não existe. Execute 'npm run dist' primeiro.`);
  process.exit(1);
}

const exeName = `Capy.ofc-Setup-${version}.exe`;
const portableName = `Capy.ofc-Portable-${version}.exe`;
const blockmapName = `${exeName}.blockmap`;
const ymlName = `latest.yml`;

const exePath = path.join(releaseDir, exeName);
const portablePath = path.join(releaseDir, portableName);
const blockmapPath = path.join(releaseDir, blockmapName);
const ymlPath = path.join(releaseDir, ymlName);

let hasErrors = false;

// 1. Verificar instalador .exe
if (fs.existsSync(exePath)) {
  const stat = fs.statSync(exePath);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
  console.log(`[OK] Instalador Windows encontrado:`);
  console.log(`     Arquivo: ${exeName}`);
  console.log(`     Tamanho: ${sizeMb} MB (${stat.size} bytes)`);
} else {
  console.error(`[FALHA] Instalador '${exeName}' não encontrado em ${releaseDir}.`);
  hasErrors = true;
}

// 1.1 Verificar versão portátil (se gerada)
if (fs.existsSync(portablePath)) {
  const stat = fs.statSync(portablePath);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
  console.log(`[OK] Executável Portátil (Diagnóstico) encontrado:`);
  console.log(`     Arquivo: ${portableName}`);
  console.log(`     Tamanho: ${sizeMb} MB (${stat.size} bytes)`);
}

// 2. Verificar mapa de blocos diferenciais (.blockmap)
if (fs.existsSync(blockmapPath)) {
  const stat = fs.statSync(blockmapPath);
  const sizeKb = (stat.size / 1024).toFixed(1);
  console.log(`[OK] Mapa de blocos diferenciais (.blockmap):`);
  console.log(`     Arquivo: ${blockmapName}`);
  console.log(`     Tamanho: ${sizeKb} KB (${stat.size} bytes)`);
  console.log(`     Suporte a atualização diferencial: ATIVO`);
} else {
  console.warn(`[AVISO] Arquivo .blockmap não encontrado. Atualizações diferenciais podem não estar disponíveis.`);
}

// 3. Verificar manifesto latest.yml
if (fs.existsSync(ymlPath)) {
  const ymlContent = fs.readFileSync(ymlPath, "utf8");
  console.log(`[OK] Manifesto latest.yml encontrado:\n---`);
  console.log(ymlContent.trim());
  console.log(`---`);

  // Validar SHA-512 do instalador
  if (fs.existsSync(exePath)) {
    console.log(`Calculando hash SHA-512 do executável...`);
    const fileBuffer = fs.readFileSync(exePath);
    const hash = crypto.createHash("sha512").update(fileBuffer).digest("base64");
    if (ymlContent.includes(hash)) {
      console.log(`[OK] Integridade SHA-512 confirmada com sucesso!`);
    } else {
      console.warn(`[AVISO] O hash calculado não coincide com o texto em latest.yml.`);
      hasErrors = true;
    }
  }
} else {
  console.error(`[FALHA] Manifesto 'latest.yml' não encontrado. O electron-updater necessita deste arquivo.`);
  hasErrors = true;
}

console.log(`\n========================================`);
if (hasErrors) {
  console.error(`RESULTADO: Falhas detectadas nos artefatos.`);
  process.exit(1);
} else {
  console.log(`RESULTADO: Todos os artefatos estão íntegros e prontos para distribuição!`);
  console.log(`========================================\n`);
}
