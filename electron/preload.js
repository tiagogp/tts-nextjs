/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("phraseLoop", {
  toggleFullscreen() {
    ipcRenderer.send("phrase-loop:toggle-fullscreen");
  },
  aiSettings: {
    save(patch) {
      return ipcRenderer.invoke("phrase-loop:ai-settings-save", patch);
    },
    test(provider, draft) {
      return ipcRenderer.invoke("phrase-loop:ai-settings-test", provider, draft);
    },
  },
  files: {
    saveApkg(filename, base64) {
      return ipcRenderer.invoke("phrase-loop:save-apkg", filename, base64);
    },
    revealApkgDebugLog() {
      return ipcRenderer.invoke("phrase-loop:reveal-apkg-debug-log");
    },
    getApkgDebugInfo() {
      return ipcRenderer.invoke("phrase-loop:get-apkg-debug-info");
    },
  },
});
