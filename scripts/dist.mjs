import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
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
const child = spawn(
  process.execPath,
  ["node_modules/electron-builder/cli.js", "--win", "nsis", "--x64", "--publish", "never"],
  { stdio: "inherit", env },
);
child.on("exit", (code) => process.exit(code ?? 1));
