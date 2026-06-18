/* eslint-disable @typescript-eslint/no-require-imports */
// Electron launcher for the PhraseLoop app.
//
// This is a thin native-window wrapper. It does NOT bundle the Next.js app or
// the Python backend (the venv + ML models are GBs). Instead it boots the
// existing services from the project directory and shows the UI in a window.
//
// Boot sequence: backend (uvicorn) -> wait /health -> frontend (next) ->
// wait :3000 -> load in window. On quit, the whole process group is killed.

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

// Where the actual project lives. When running unpacked (npm run app) this is
// the repo root. When packaged, the .app references the project on disk since
// the venv/models can't be bundled. Override with TTS_PROJECT_ROOT if you move
// the project.
const PROJECT_ROOT =
  process.env.TTS_PROJECT_ROOT ||
  (app.isPackaged
    ? "/Users/tiagogp/Documents/text-to-speech"
    : path.resolve(__dirname, ".."));

const BACKEND_PORT = 5002;
const FRONTEND_PORT = 3000;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
const BACKEND_HEALTH = `http://localhost:${BACKEND_PORT}/health`;
const APP_ICON_PNG = path.join(__dirname, "assets", "icon.png");
const PRELOAD_JS = path.join(__dirname, "preload.js");

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let mainWindow = null;
let shuttingDown = false;

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

function projectEnv(nodeEnv) {
  // Mirrors Next's env lookup order. Existing process.env wins, then the first
  // project .env file that defines a key wins.
  const env = { ...process.env };
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

// Spawn through a login shell so PATH includes nvm/homebrew node, the venv, etc.
// detached:true puts each child in its own process group so we can kill the
// whole tree (shell + next/uvicorn + their workers) on quit.
function spawnService(name, command, cwd, baseEnv) {
  // ELECTRON_RUN_AS_NODE leaks in if the app was launched from an Electron-based
  // parent (e.g. an editor terminal); strip it so npm/next/python run normally.
  const env = { ...baseEnv, BACKEND_PYTHON: `${PROJECT_ROOT}/backend/.venv/bin/python` };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn("/bin/zsh", ["-lc", command], {
    cwd,
    detached: true,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tag = `[${name}]`;
  child.stdout.on("data", (d) => process.stdout.write(`${tag} ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`${tag} ${d}`));
  child.on("exit", (code) => {
    if (!shuttingDown) console.error(`${tag} exited with code ${code}`);
  });
  children.push(child);
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

function setStatus(text) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents
      .executeJavaScript(`window.setStatus && window.setStatus(${JSON.stringify(text)})`)
      .catch(() => {});
  }
}

async function boot() {
  if (!fs.existsSync(PROJECT_ROOT)) {
    console.error(`Project not found at ${PROJECT_ROOT}. Set TTS_PROJECT_ROOT.`);
    setStatus("PhraseLoop couldn't open. Check the app logs for details.");
    return;
  }

  const built = fs.existsSync(path.join(PROJECT_ROOT, ".next", "BUILD_ID"));
  const serviceEnv = projectEnv(process.env.NODE_ENV || (built ? "production" : "development"));

  // 1. Backend
  setStatus("Preparing PhraseLoop…");
  spawnService(
    "backend",
    `exec .venv/bin/uvicorn tts_server:app --port ${BACKEND_PORT} --log-level warning`,
    path.join(PROJECT_ROOT, "backend"),
    serviceEnv
  );
  await waitFor(BACKEND_HEALTH, "Backend");

  // 2. Frontend — prod if built, else dev.
  setStatus("Opening PhraseLoop…");
  spawnService(
    "frontend",
    built ? "exec npm run start" : "exec npm run dev",
    PROJECT_ROOT,
    serviceEnv
  );
  await waitFor(FRONTEND_URL, "Frontend");

  // 3. Show it
  if (mainWindow && !mainWindow.isDestroyed()) {
    await mainWindow.loadURL(FRONTEND_URL);
  }
}

app.whenReady().then(() => {
  if (process.platform === "darwin" && fs.existsSync(APP_ICON_PNG)) {
    app.dock.setIcon(APP_ICON_PNG);
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
