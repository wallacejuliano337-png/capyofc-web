import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import fs from "node:fs";

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

console.log(`\n========================================`);
console.log(`CAPYCHAT — PUBLICAÇÃO NO GITHUB RELEASES`);
console.log(`Versão: v${pkg.version}`);
console.log(`========================================\n`);

if (!token) {
  console.error(`[ERRO DE CREDENCIAIS] Nenhuma chave 'GH_TOKEN' ou 'GITHUB_TOKEN' detectada no ambiente.`);
  console.error(`Para publicar uma release oficial no GitHub Releases:`);
  console.error(`1. Gere um Personal Access Token (classic) no GitHub com escopo 'repo'.`);
  console.error(`2. Defina no terminal: $env:GH_TOKEN="seu_token"`);
  console.error(`3. Execute novamente: npm run dist:publish\n`);
  process.exit(1);
}

await mkdir(".cache/tmp", { recursive: true });
const env = {
  ...process.env,
  TEMP: path.join(root, ".cache/tmp"),
  TMP: path.join(root, ".cache/tmp"),
  ELECTRON_BUILDER_CACHE: path.join(root, ".cache/electron-builder"),
  ELECTRON_CACHE: path.join(root, ".cache/electron"),
  electron_config_cache: path.join(root, ".cache/electron"),
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
};

console.log(`Iniciando build e publicação com electron-builder (--publish always)...`);
const child = spawn(
  process.execPath,
  ["node_modules/electron-builder/cli.js", "--win", "nsis", "--x64", "--publish", "always"],
  { stdio: "inherit", env },
);

child.on("exit", (code) => {
  if (code === 0) {
    console.log(`\n[SUCESSO] Versão v${pkg.version} publicada com sucesso no GitHub Releases!`);
  } else {
    console.error(`\n[FALHA] Falha na publicação. Código de saída: ${code}`);
  }
  process.exit(code ?? 1);
});
