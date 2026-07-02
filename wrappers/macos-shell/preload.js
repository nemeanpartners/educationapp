const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("eduRevShell", {
  isDesktopShell: true,
  openWordOnline(payload) {
    ipcRenderer.send("word-online:open", payload);
  },
  updateWordOnlineBounds(bounds) {
    ipcRenderer.send("word-online:update-bounds", bounds);
  },
  closeWordOnline() {
    ipcRenderer.send("word-online:close");
  },
  openGooglePage(payload) {
    ipcRenderer.send("google-page:open", payload);
  },
  updateGooglePageBounds(bounds) {
    ipcRenderer.send("google-page:update-bounds", bounds);
  },
  closeGooglePage() {
    ipcRenderer.send("google-page:close");
  },
});
