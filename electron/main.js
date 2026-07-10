/* eslint-disable @typescript-eslint/no-require-imports */
// Electron launcher for the PhraseLoop app.
//
// Boot sequence: native-capable Next server -> BrowserWindow.

const { app, BrowserWindow, ipcMain, Menu, shell, utilityProcess } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

app.setName("PhraseLoop");

// In development, run from the repo. In the packaged app, run from resources
// copied by electron-builder so the app does not depend on a source checkout.
const DEV_PROJECT_ROOT = path.resolve(__dirname, "..");
const PACKAGED_NEXT_ROOT = path.join(process.resourcesPath, "app-next");
const PROJECT_ROOT = process.env.TTS_PROJECT_ROOT || DEV_PROJECT_ROOT;
const NEXT_ROOT = app.isPackaged ? PACKAGED_NEXT_ROOT : PROJECT_ROOT;
const WHISPER_NATIVE_DIR = path.join(NEXT_ROOT, "node_modules", "@kutalia", "whisper-node-addon", "dist");

const FRONTEND_PORT = 3000;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
const APP_ICON_PNG = path.join(__dirname, "assets", "icon.png");
const PRELOAD_JS = path.join(__dirname, "preload.js");
const USER_ENV_FILE = path.join(app.getPath("userData"), "phraseloop.env");
const AI_SETTINGS_FALLBACK_FILE = path.join(app.getPath("userData"), "ai-settings.json");
const APKG_DEBUG_LOG_FILE = path.join(app.getPath("userData"), "logs", "apkg-debug.jsonl");
const SETTINGS_TOKEN = crypto.randomBytes(32).toString("hex");
const LEGACY_DATA_DIRS = [
  path.join(os.homedir(), "Library", "Application Support", "text-to-speech"),
  path.join(os.homedir(), "Library", "Application Support", "Electron"),
];

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
/** @type {import('electron').UtilityProcess[]} */
const utilityChildren = [];
let mainWindow = null;
let shuttingDown = false;

function cleanSetting(value, maxLength) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : undefined;
}

function loadSecureAiSettings() {
  if (!fs.existsSync(AI_SETTINGS_FALLBACK_FILE)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(AI_SETTINGS_FALLBACK_FILE, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveSecureAiSettings(settings) {
  fs.mkdirSync(path.dirname(AI_SETTINGS_FALLBACK_FILE), { recursive: true });
  fs.writeFileSync(AI_SETTINGS_FALLBACK_FILE, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(AI_SETTINGS_FALLBACK_FILE, 0o600);
}

function secureStorageMode() {
  return "local-file";
}

function prependPathValue(current, value) {
  return current ? `${value}${path.delimiter}${current}` : value;
}

function nativeLibraryEnv() {
  if (process.platform === "linux" && process.arch === "x64") {
    const libDir = path.join(WHISPER_NATIVE_DIR, "linux-x64");
    return {
      LD_LIBRARY_PATH: prependPathValue(process.env.LD_LIBRARY_PATH || "", libDir),
    };
  }
  if (process.platform === "win32" && process.arch === "x64") {
    const libDir = path.join(WHISPER_NATIVE_DIR, "win32-x64");
    return {
      PATH: prependPathValue(process.env.PATH || "", libDir),
    };
  }
  return {};
}

function safeDownloadFilename(value) {
  const raw = typeof value === "string" ? value : "anki-deck.apkg";
  const cleaned = raw
    .trim()
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\.+$/, "")
    .slice(0, 120);
  const withExtension = cleaned.toLowerCase().endsWith(".apkg")
    ? cleaned
    : `${cleaned || "anki-deck"}.apkg`;
  return path.basename(withExtension) || "anki-deck.apkg";
}

function uniqueDownloadPath(filename) {
  const downloads = app.getPath("downloads");
  const safe = safeDownloadFilename(filename);
  const parsed = path.parse(safe);
  let candidate = path.join(downloads, safe);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(downloads, `${parsed.name} ${index}${parsed.ext || ".apkg"}`);
    index += 1;
  }
  return candidate;
}

async function internalSettingsRequest(pathname, method, body) {
  const response = await fetch(`${FRONTEND_URL}${pathname}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-phraseloop-settings-token": SETTINGS_TOKEN,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("PhraseLoop could not update its AI settings.");
  return response.json();
}

async function syncSecureAiSettings() {
  const result = await internalSettingsRequest("/api/settings/runtime", "PUT", loadSecureAiSettings());
  return typeof result?.version === "number" ? result.version : 0;
}

function parseEnvFile(file) {
  const parsed = {};
  if (!fs.existsSync(file)) return parsed;

  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();
    const quote = value[0];
    const quoted = (quote === '"' || quote === "'") && value.endsWith(quote);

    if (quoted) {
      value = value.slice(1, -1);
      if (quote === '"') {
        value = value
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
      }
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }

    parsed[key] = value;
  }
  return parsed;
}

function ensureUserEnvFile() {
  if (fs.existsSync(USER_ENV_FILE)) return;
  fs.mkdirSync(path.dirname(USER_ENV_FILE), { recursive: true });
  fs.writeFileSync(
    USER_ENV_FILE,
    [
      "# PhraseLoop provider configuration",
      "# Ollama is used automatically when it is running on localhost:11434.",
      "# Otherwise, set one of these keys and restart the app:",
      "# ANTHROPIC_API_KEY=sk-ant-...",
      "# OPENAI_API_KEY=sk-...",
      "# Optional:",
      "# OLLAMA_BASE_URL=http://localhost:11434",
      "# OLLAMA_MODEL=llama3.1",
      "",
    ].join("\n"),
  );
}

function projectEnv(nodeEnv) {
  // Mirrors Next's env lookup order. Existing process.env wins, then the first
  // user/app/project .env file that defines a key wins.
  const env = { ...process.env };
  ensureUserEnvFile();

  for (const [key, value] of Object.entries(parseEnvFile(USER_ENV_FILE))) {
    if (env[key] === undefined) env[key] = value;
  }

  const files = [
    `.env.${nodeEnv}.local`,
    ...(nodeEnv === "test" ? [] : [".env.local"]),
    `.env.${nodeEnv}`,
    ".env",
  ];

  for (const file of files) {
    const parsed = parseEnvFile(path.join(PROJECT_ROOT, file));
    for (const [key, value] of Object.entries(parsed)) {
      if (env[key] === undefined) env[key] = value;
    }
  }

  return env;
}

function spawnService(name, command, args, cwd, baseEnv, options = {}) {
  const env = {
    ...baseEnv,
    ...(options.env || {}),
  };
  if (!options.keepElectronRunAsNode) delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(command, args, {
    cwd,
    detached: options.detached !== false,
    env,
    stdio: options.stdio || ["ignore", "pipe", "pipe"],
  });
  const tag = `[${name}]`;
  child.stdout?.on("data", (d) => process.stdout.write(`${tag} ${d}`));
  child.stderr?.on("data", (d) => process.stderr.write(`${tag} ${d}`));
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`${tag} exited with code ${code}`);
      if (name === "frontend" && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadFile(path.join(__dirname, "loading.html")).then(() => {
          setStatus("PhraseLoop stopped unexpectedly. Restart the app.");
        }).catch(() => {});
      }
    }
  });
  children.push(child);
  return child;
}

// Run the standalone Next backend as an Electron utility process instead of a
// detached `process.execPath` child. A utility process runs a real Node
// runtime (native ML addons load fine) but stays a background "utility" process
// type: it never gets its own Dock icon — not even after loading GPU/Metal —
// and it is reaped automatically when the app quits.
function onBackendExit(code) {
  if (shuttingDown) return;
  console.error(`[frontend] exited with code ${code}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile(path.join(__dirname, "loading.html")).then(() => {
      setStatus("PhraseLoop stopped unexpectedly. Restart the app.");
    }).catch(() => {});
  }
}

function forkBackend(serverJs, cwd, env) {
  const childEnv = { ...env };
  delete childEnv.ELECTRON_RUN_AS_NODE;
  const child = utilityProcess.fork(serverJs, [], {
    cwd,
    env: childEnv,
    serviceName: "PhraseLoop backend",
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => process.stdout.write(`[frontend] ${d}`));
  child.stderr?.on("data", (d) => process.stderr.write(`[frontend] ${d}`));
  child.on("exit", onBackendExit);
  utilityChildren.push(child);
  return child;
}

function killChildren() {
  shuttingDown = true;
  for (const child of children) {
    if (child.pid && !child.killed) {
      try {
        // negative pid => kill the whole process group
        process.kill(-child.pid, "SIGTERM");
      } catch {
        try {
          child.kill("SIGTERM");
        } catch {
          /* already gone */
        }
      }
    }
  }
  for (const child of utilityChildren) {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
  }
}

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on("error", reject);
    req.setTimeout(2000, () => req.destroy(new Error("timeout")));
  });
}

async function waitFor(url, label, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const status = await get(url);
      if (status && status < 500) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} did not become ready within ${timeoutMs / 1000}s`);
}

function createWindow() {
  const isMac = process.platform === "darwin";

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    title: "PhraseLoop",
    icon: APP_ICON_PNG,
    backgroundColor: "#0a0a0a",
    titleBarStyle: isMac ? "hiddenInset" : "default",
    trafficLightPosition: isMac ? { x: 18, y: 18 } : undefined,
    webPreferences: { contextIsolation: true, preload: PRELOAD_JS },
  });

  // Open target=_blank / external links in the system browser, not the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(FRONTEND_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(FRONTEND_URL)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });

  mainWindow.loadFile(path.join(__dirname, "loading.html"));
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents
      .executeJavaScript('document.documentElement.dataset.electron = "true"')
      .catch(() => {});
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  return mainWindow;
}

ipcMain.on("phrase-loop:toggle-fullscreen", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;
  window.setFullScreen(!window.isFullScreen());
});

// One calm re-engagement pull: reflect the due-review count on the dock badge.
// No notifications, no framework — just a quiet number the learner can ignore.
ipcMain.on("phrase-loop:set-due-count", (_event, rawCount) => {
  if (process.platform !== "darwin" || !app.dock) return;
  const count = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 0;
  app.dock.setBadge(count > 0 ? String(count) : "");
});

ipcMain.handle("phrase-loop:ai-settings-save", async (event, rawPatch) => {
  try {
    if (!event.senderFrame?.url.startsWith(FRONTEND_URL)) throw new Error("Untrusted settings request.");
    const patch = rawPatch && typeof rawPatch === "object" ? rawPatch : {};
    const current = loadSecureAiSettings();
    const next = { ...current };
    if (["ollama", "openrouter", "claude", "openai"].includes(patch.defaultProvider)) {
      next.defaultProvider = patch.defaultProvider;
    }
    for (const [input, stored, max] of [
      ["ollamaBaseUrl", "ollamaBaseUrl", 2048],
      ["ollamaModel", "ollamaModel", 100],
      ["anthropicApiKey", "anthropicApiKey", 500],
      ["openaiApiKey", "openaiApiKey", 500],
      ["openrouterApiKey", "openrouterApiKey", 500],
    ]) {
      if (!(input in patch)) continue;
      const value = cleanSetting(patch[input], max);
      if (value) next[stored] = value;
      else delete next[stored];
    }
    saveSecureAiSettings(next);
    const version = await syncSecureAiSettings();
    return { ok: true, version };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save settings." };
  }
});

ipcMain.handle("phrase-loop:ai-settings-test", async (event, provider, draft) => {
  try {
    if (!event.senderFrame?.url.startsWith(FRONTEND_URL)) throw new Error("Untrusted settings request.");
    const result = await internalSettingsRequest("/api/settings/test", "POST", {
      provider,
      ...(draft && typeof draft === "object" ? draft : {}),
    });
    return {
      ok: result.ok === true,
      detail: typeof result.detail === "string" ? result.detail : "Connection test finished.",
    };
  } catch {
    return { ok: false, detail: "Could not reach the PhraseLoop backend." };
  }
});

ipcMain.handle("phrase-loop:save-apkg", async (event, filename, base64) => {
  try {
    if (!event.senderFrame?.url.startsWith(FRONTEND_URL)) {
      throw new Error("Untrusted file save request.");
    }
    if (typeof base64 !== "string" || base64.length === 0) {
      throw new Error("No Anki package data was generated.");
    }
    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength === 0) throw new Error("The generated Anki package is empty.");
    if (bytes.byteLength > 200 * 1024 * 1024) throw new Error("The Anki package is too large to save.");
    const outPath = uniqueDownloadPath(filename);
    fs.writeFileSync(outPath, bytes);
    return { ok: true, path: outPath };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save the Anki package.",
    };
  }
});

ipcMain.handle("phrase-loop:get-apkg-debug-info", async (event) => {
  try {
    if (!event.senderFrame?.url.startsWith(FRONTEND_URL)) {
      throw new Error("Untrusted debug request.");
    }
    return {
      ok: true,
      path: APKG_DEBUG_LOG_FILE,
      exists: fs.existsSync(APKG_DEBUG_LOG_FILE),
      size: fs.existsSync(APKG_DEBUG_LOG_FILE) ? fs.statSync(APKG_DEBUG_LOG_FILE).size : 0,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not read debug info.",
    };
  }
});

ipcMain.handle("phrase-loop:reveal-apkg-debug-log", async (event) => {
  try {
    if (!event.senderFrame?.url.startsWith(FRONTEND_URL)) {
      throw new Error("Untrusted debug request.");
    }
    fs.mkdirSync(path.dirname(APKG_DEBUG_LOG_FILE), { recursive: true });
    if (!fs.existsSync(APKG_DEBUG_LOG_FILE)) fs.writeFileSync(APKG_DEBUG_LOG_FILE, "");
    shell.showItemInFolder(APKG_DEBUG_LOG_FILE);
    return { ok: true, path: APKG_DEBUG_LOG_FILE };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not reveal debug log.",
    };
  }
});

function setStatus(text) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents
      .executeJavaScript(`window.setStatus && window.setStatus(${JSON.stringify(text)})`)
      .catch(() => {});
  }
}

// The app ships ad-hoc signed (no Developer ID / notarization). When the .dmg
// is downloaded, macOS tags the bundle — including its native addons — with
// com.apple.quarantine. Gatekeeper can then prevent the embedded Next runtime
// from becoming ready,
// the window loads forever. Once the user has approved the app, the main
// process can clear the quarantine from its own resources so the embedded Next
// runtime and signed native addons can load.
function clearOwnQuarantine() {
  if (!app.isPackaged || process.platform !== "darwin") return;
  // Resources/.. = Contents, /.. = the .app bundle root. Strip recursively.
  const appBundle = path.resolve(process.resourcesPath, "..", "..");
  for (const target of [process.resourcesPath, appBundle]) {
    try {
      spawnSync("/usr/bin/xattr", ["-dr", "com.apple.quarantine", target], {
        stdio: "ignore",
        timeout: 30000,
      });
    } catch {
      /* best-effort; nothing to do if it fails */
    }
  }
}

function migrateLegacyModels(dataDir) {
  const targetModels = path.join(dataDir, "models", "native");
  for (const legacyDir of LEGACY_DATA_DIRS) {
    if (path.resolve(legacyDir) === path.resolve(dataDir)) continue;
    const legacyModels = path.join(legacyDir, "models", "native");
    for (const modelId of ["kokoro-1.0", "whisper-small"]) {
      const from = path.join(legacyModels, modelId);
      const to = path.join(targetModels, modelId);
      if (fs.existsSync(to) || !fs.existsSync(path.join(from, ".ready.json"))) continue;
      try {
        fs.mkdirSync(targetModels, { recursive: true });
        fs.cpSync(from, to, { recursive: true, errorOnExist: true });
        console.log(`Migrated ${modelId} model from ${legacyDir}`);
      } catch (error) {
        console.error(
          `Could not migrate ${modelId} model from ${legacyDir}:`,
          error instanceof Error ? error.message : "unknown error",
        );
      }
    }
  }
}

async function boot() {
  clearOwnQuarantine();

  if (!fs.existsSync(NEXT_ROOT)) {
    console.error(`Next app not found at ${NEXT_ROOT}. Rebuild the app.`);
    setStatus("PhraseLoop couldn't open. Check the app logs for details.");
    return;
  }
  const standaloneServer = path.join(NEXT_ROOT, "server.js");
  const built = app.isPackaged || fs.existsSync(path.join(PROJECT_ROOT, ".next", "BUILD_ID"));
  const dataDir = app.getPath("userData");
  const bundledModelsDir = path.join(process.resourcesPath, "models", "native");
  migrateLegacyModels(dataDir);
  fs.mkdirSync(path.join(dataDir, "logs"), { recursive: true });
  const serviceEnv = {
    ...projectEnv(process.env.NODE_ENV || (built ? "production" : "development")),
    ...nativeLibraryEnv(),
    PHRASELOOP_DATA_DIR: dataDir,
    ...(app.isPackaged && fs.existsSync(bundledModelsDir)
      ? { PHRASELOOP_BUNDLED_MODELS_DIR: bundledModelsDir }
      : {}),
    PHRASELOOP_SETTINGS_STORAGE: secureStorageMode(),
    PHRASELOOP_SETTINGS_TOKEN: SETTINGS_TOKEN,
  };

  // Frontend and all local ML services live in the standalone Node server.
  // Native addons execute expensive work asynchronously; models download on demand.
  setStatus("Opening PhraseLoop…");
  if (app.isPackaged || fs.existsSync(standaloneServer)) {
    forkBackend(standaloneServer, NEXT_ROOT, {
      ...serviceEnv,
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      PORT: String(FRONTEND_PORT),
    });
  } else {
    spawnService("frontend", "npm", ["run", "dev"], PROJECT_ROOT, serviceEnv, {});
  }
  await waitFor(FRONTEND_URL, "Frontend");
  await syncSecureAiSettings().catch((error) => {
    console.error("AI settings sync failed:", error instanceof Error ? error.message : "unknown error");
  });

  // Show it.
  if (mainWindow && !mainWindow.isDestroyed()) {
    await mainWindow.loadURL(FRONTEND_URL);
  }
}

app.whenReady().then(() => {
  if (process.platform === "darwin" && fs.existsSync(APP_ICON_PNG)) {
    app.dock.setIcon(APP_ICON_PNG);
  }
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
  }

  createWindow();
  boot().catch((err) => {
    console.error("Boot failed:", err);
    setStatus("PhraseLoop couldn't open. Check the app logs for details.");
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (children.length) mainWindow.loadURL(FRONTEND_URL);
      else boot().catch(() => {});
    }
  });
});

app.on("window-all-closed", () => {
  killChildren();
  app.quit();
});

app.on("before-quit", killChildren);
process.on("exit", killChildren);
process.on("SIGINT", () => {
  killChildren();
  process.exit(0);
});
