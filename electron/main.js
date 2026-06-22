/* eslint-disable @typescript-eslint/no-require-imports */
// Electron launcher for the PhraseLoop app.
//
// Boot sequence: native-capable Next server -> BrowserWindow.

const { app, BrowserWindow, ipcMain, shell, utilityProcess } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

// In development, run from the repo. In the packaged app, run from resources
// copied by electron-builder so the app does not depend on a source checkout.
const DEV_PROJECT_ROOT = path.resolve(__dirname, "..");
const PACKAGED_NEXT_ROOT = path.join(process.resourcesPath, "app-next");
const PROJECT_ROOT = process.env.TTS_PROJECT_ROOT || DEV_PROJECT_ROOT;
const NEXT_ROOT = app.isPackaged ? PACKAGED_NEXT_ROOT : PROJECT_ROOT;

const FRONTEND_PORT = 3000;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
const APP_ICON_PNG = path.join(__dirname, "assets", "icon.png");
const PRELOAD_JS = path.join(__dirname, "preload.js");
const USER_ENV_FILE = path.join(app.getPath("userData"), "phraseloop.env");

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
/** @type {import('electron').UtilityProcess[]} */
const utilityChildren = [];
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
  fs.mkdirSync(path.join(dataDir, "logs"), { recursive: true });
  const serviceEnv = {
    ...projectEnv(process.env.NODE_ENV || (built ? "production" : "development")),
    PHRASELOOP_DATA_DIR: dataDir,
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

  // Show it.
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
