/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("phraseLoop", {
  toggleFullscreen() {
    ipcRenderer.send("phrase-loop:toggle-fullscreen");
  },
});
