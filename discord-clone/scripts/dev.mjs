import { spawn } from "node:child_process";
import { createServer } from "vite";
await import("./electron.mjs");
const server = await createServer();
await server.listen();
const { default: electron } = await import("electron");
const child =
  process.platform === "win32"
    ? spawn(
        "powershell.exe",
        ["-ExecutionPolicy", "Bypass", "-File", "scripts/launch-desktop.ps1"],
        {
          stdio: "inherit",
          windowsHide: false,
          env: {
            ...process.env,
            LYC_DEV_URL: "http://127.0.0.1:5173",
            LYC_OPEN_ROLES: process.env.LYC_OPEN_ROLES || "0",
          },
        },
      )
    : spawn(electron, ["."], {
        stdio: "inherit",
        env: {
          ...process.env,
          LYC_DEV_URL: "http://127.0.0.1:5173",
          LYC_OPEN_ROLES: process.env.LYC_OPEN_ROLES || "0",
        },
      });
child.on("exit", async () => {
  await server.close();
  process.exit();
});
process.on("SIGINT", () => {
  child.kill();
  if (process.platform === "win32") {
    spawn("taskkill", ["/F", "/IM", "electron.exe"], { stdio: "ignore" });
  }
});
