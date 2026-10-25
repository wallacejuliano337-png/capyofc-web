import { spawn } from "node:child_process";
import electron from "electron";

console.log("Iniciando LYC Arena na tela de login...");
const child = spawn(electron, [".", "--preview-login"], {
  stdio: "inherit",
  windowsHide: false,
});

child.on("exit", (code) => {
  console.log("LYC Arena encerrado com código:", code);
  process.exit(code ?? 0);
});
