import { _electron as electron } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("test-results", { recursive: true });
const app = await electron.launch({
  ...(process.env.LYC_TEST_PACKAGED === "1"
    ? {
        executablePath: "D:\\LYC-Arena\\release\\win-unpacked\\LYC Arena.exe",
        args: ["--user-data-dir=D:\\LYC-Arena\\.cache\\packaged-user-data"],
      }
    : { args: ["."] }),
  env: {
    ...process.env,
    TEMP: "D:\\LYC-Arena\\.cache\\tmp",
    TMP: "D:\\LYC-Arena\\.cache\\tmp",
  },
});
const errors = [];
const page = await app.firstWindow();
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.getByRole("button", { name: "Explorar modo local" }).click();
  await page.getByRole("heading", { name: "Salve," }).waitFor();
  await page.screenshot({ path: "test-results/home.png" });
  await page.getByRole("button", { name: "Entrar na comunidade" }).click();
  await page
    .getByRole("textbox", { name: "Mensagem", exact: true })
    .fill("Teste desktop LYC " + Date.now());
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await page.locator(".message").last().waitFor();
  await page.screenshot({ path: "test-results/chat.png" });
  await page
    .locator("nav")
    .getByRole("button", { name: "Equipes", exact: true })
    .click();
  await page.getByRole("button", { name: "Criar equipe", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Squad de teste");
  await page
    .getByLabel("Tag", { exact: true })
    .fill("QA" + Math.floor(Math.random() * 1000));
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Criar equipe", exact: true })
    .click();
  await page.locator(".team-card").first().waitFor();
  await page
    .locator("nav")
    .getByRole("button", { name: "Tickets", exact: true })
    .click();
  await page.getByRole("button", { name: "Abrir ticket", exact: true }).click();
  await page.getByLabel("Assunto", { exact: true }).fill("Teste de suporte");
  await page
    .getByLabel("O que aconteceu?")
    .fill("Verificação automatizada local.");
  await page
    .getByRole("button", { name: "Enviar ticket", exact: true })
    .click();
  await page.locator(".ticket-row").first().click();
  await page
    .getByRole("textbox", { name: "Resposta ao ticket" })
    .fill("Resposta persistida no computador.");
  await page.locator(".composer button").click();
  await page
    .getByText("Resposta persistida no computador.", { exact: true })
    .last()
    .waitFor();
  const security = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    const p = w.webContents.getLastWebPreferences();
    return {
      contextIsolation: p.contextIsolation,
      nodeIntegration: p.nodeIntegration,
      sandbox: p.sandbox,
    };
  });
  assert.deepEqual(security, {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  });
  const sources = await page.evaluate(() => window.arena.sources());
  assert.ok(sources.length > 0);
  const bad = await page.evaluate(async () => {
    try {
      await window.arena.selectSource("invalid", false);
      return false;
    } catch {
      return true;
    }
  });
  assert.equal(bad, true);
  const capture = await page.evaluate(async () => {
    const sources = await window.arena.sources();
    const source =
      sources.find((s) => s.id.startsWith("screen:")) || sources[0];
    await window.arena.selectSource(source.id, false);
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: 1280, height: 720, frameRate: 30 },
      audio: false,
    });
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();
    const live = track.readyState === "live";
    stream.getTracks().forEach((t) => t.stop());
    return { live, width: settings.width, height: settings.height };
  });
  assert.equal(capture.live, true);
  assert.ok(capture.width > 0);
  await page.reload();
  await page.getByRole("button", { name: "Explorar modo local" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Equipes", exact: true })
    .click();
  await page.locator(".team-card").first().waitFor();

  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  assert.deepEqual(errors, []);
  await writeFile(
    process.env.LYC_TEST_PACKAGED === "1"
      ? "test-results/desktop-packaged.json"
      : "test-results/desktop.json",
    JSON.stringify(
      { passed: true, security, sourceCount: sources.length, capture, errors },
      null,
      2,
    ),
  );
  console.log(
    "Desktop smoke passed: navigation, chat, team, ticket, IPC validation and capture sources.",
  );
} finally {
  await app.close();
}
