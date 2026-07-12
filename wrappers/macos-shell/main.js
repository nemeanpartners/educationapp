const path = require("path");
const { app, BrowserWindow, shell, ipcMain, BrowserView } = require("electron");

const APP_ORIGIN = "https://edurevolution-ai-wyxvlktr5q-uw.a.run.app";
const APP_URL = `${APP_ORIGIN}/auth?shell=macos`;
const FIREBASE_AUTH_ORIGIN = "https://www.educationrevolution.qld.one";
const CUSTOM_PROTOCOL = "edurevolutionai";
const APP_NAME = "EduRev";
const DOCK_ICON = path.join(__dirname, "build", "icon-1024.png");

let mainWindow = null;
let officeWindow = null;
let embeddedWordView = null;
let embeddedGoogleView = null;
let pendingDeepLink = null;
let wordSessionNonce = Date.now();

app.commandLine.appendSwitch("disable-http-cache");

function isInternalWrapperUrl(url) {
  return url.startsWith(APP_ORIGIN) || url.startsWith(FIREBASE_AUTH_ORIGIN);
}

function withFreshShellQuery(url) {
  try {
    const parsed = new URL(url);
    if (!isInternalWrapperUrl(parsed.toString())) {
      return url;
    }
    parsed.searchParams.set("_shellRefresh", String(Date.now()));
    return parsed.toString();
  } catch {
    return url;
  }
}

function isMicrosoftOfficeInAppUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "office.com" ||
      host === "www.office.com" ||
      host === "microsoft.com" ||
      host === "www.microsoft.com" ||
      host === "microsoft365.com" ||
      host === "www.microsoft365.com" ||
      host === "office.live.com" ||
      host === "onedrive.live.com" ||
      host === "login.live.com" ||
      host === "login.microsoftonline.com" ||
      host.endsWith(".officeapps.live.com") ||
      host.endsWith(".sharepoint.com") ||
      host.endsWith(".office.com") ||
      host.endsWith(".microsoft365.com") ||
      host.endsWith(".microsoft.com")
    );
  } catch {
    return false;
  }
}

function isGoogleInAppUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "google.com" ||
      host === "www.google.com" ||
      host.endsWith(".google.com")
    );
  } catch {
    return false;
  }
}

function isAllowedAuthPopupUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "accounts.google.com" ||
      host.endsWith(".accounts.google.com") ||
      host === "login.microsoftonline.com" ||
      host.endsWith(".login.microsoftonline.com") ||
      host === "login.live.com" ||
      host.endsWith(".live.com") ||
      host === "www.educationrevolution.qld.one" ||
      host === "studio-7677496479-873b4.firebaseapp.com" ||
      host.endsWith(".firebaseapp.com") ||
      host === "edurevolution-ai-wyxvlktr5q-uw.a.run.app"
    );
  } catch {
    return false;
  }
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function normalizeBounds(bounds = {}) {
  return {
    x: Math.max(0, Math.round(bounds.x || 0)),
    y: Math.max(0, Math.round(bounds.y || 0)),
    width: Math.max(320, Math.round(bounds.width || 320)),
    height: Math.max(320, Math.round(bounds.height || 320)),
  };
}

function ensureEmbeddedWordView() {
  if (embeddedWordView && !embeddedWordView.webContents.isDestroyed()) {
    return embeddedWordView;
  }

  wordSessionNonce += 1;
  embeddedWordView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      partition: `temporary:edurev-word-${wordSessionNonce}`,
      sandbox: true,
    },
  });

  embeddedWordView.webContents.setWindowOpenHandler(({ url }) => {
    if (isMicrosoftOfficeInAppUrl(url)) {
      embeddedWordView.webContents.loadURL(url);
      return { action: "deny" };
    }

    if (isInternalWrapperUrl(url)) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(url);
        focusMainWindow();
      }
      return { action: "deny" };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });

  embeddedWordView.webContents.on("will-navigate", (event, url) => {
    if (isMicrosoftOfficeInAppUrl(url)) {
      return;
    }

    if (isInternalWrapperUrl(url)) {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(url);
        focusMainWindow();
      }
      closeEmbeddedWordView();
      return;
    }

    event.preventDefault();
    shell.openExternal(url);
  });

  return embeddedWordView;
}

function attachEmbeddedWordView(bounds) {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const view = ensureEmbeddedWordView();
  const attachedViews = mainWindow.getBrowserViews();
  if (!attachedViews.includes(view)) {
    mainWindow.addBrowserView(view);
  }
  view.setBounds(normalizeBounds(bounds));
  view.setAutoResize({ width: true, height: true });
  return view;
}

function openEmbeddedWordView(targetUrl, bounds) {
  const view = attachEmbeddedWordView(bounds);
  if (!view) return;
  Promise.allSettled([
    view.webContents.session.clearCache(),
    view.webContents.session.clearStorageData(),
  ]).finally(() => {
    if (!view.webContents.isDestroyed()) {
      view.webContents.loadURL(targetUrl);
    }
  });
}

function updateEmbeddedWordBounds(bounds) {
  if (!mainWindow || mainWindow.isDestroyed() || !embeddedWordView) return;
  embeddedWordView.setBounds(normalizeBounds(bounds));
}

function closeEmbeddedWordView() {
  if (!mainWindow || mainWindow.isDestroyed() || !embeddedWordView) return;
  if (mainWindow.getBrowserViews().includes(embeddedWordView)) {
    mainWindow.removeBrowserView(embeddedWordView);
  }
  if (!embeddedWordView.webContents.isDestroyed()) {
    embeddedWordView.webContents.destroy();
  }
  embeddedWordView = null;
}

function ensureEmbeddedGoogleView() {
  if (embeddedGoogleView && !embeddedGoogleView.webContents.isDestroyed()) {
    return embeddedGoogleView;
  }

  embeddedGoogleView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  embeddedGoogleView.webContents.setWindowOpenHandler(({ url }) => {
    embeddedGoogleView.webContents.loadURL(url);
    return { action: "deny" };
  });

  embeddedGoogleView.webContents.on("will-navigate", (_event, _url) => {
    return;
  });

  return embeddedGoogleView;
}

function attachEmbeddedGoogleView(bounds) {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const view = ensureEmbeddedGoogleView();
  const attachedViews = mainWindow.getBrowserViews();
  if (!attachedViews.includes(view)) {
    mainWindow.addBrowserView(view);
  }
  view.setBounds(normalizeBounds(bounds));
  view.setAutoResize({ width: true, height: true });
  return view;
}

function openEmbeddedGoogleView(targetUrl, bounds) {
  const view = attachEmbeddedGoogleView(bounds);
  if (!view) return;
  view.webContents.loadURL(targetUrl);
}

function updateEmbeddedGoogleBounds(bounds) {
  if (!mainWindow || mainWindow.isDestroyed() || !embeddedGoogleView) return;
  embeddedGoogleView.setBounds(normalizeBounds(bounds));
}

function closeEmbeddedGoogleView() {
  if (!mainWindow || mainWindow.isDestroyed() || !embeddedGoogleView) return;
  if (mainWindow.getBrowserViews().includes(embeddedGoogleView)) {
    mainWindow.removeBrowserView(embeddedGoogleView);
  }
  if (!embeddedGoogleView.webContents.isDestroyed()) {
    embeddedGoogleView.webContents.destroy();
  }
  embeddedGoogleView = null;
}

function createOfficeWindow(targetUrl) {
  if (officeWindow && !officeWindow.isDestroyed()) {
    officeWindow.loadURL(targetUrl);
    officeWindow.show();
    officeWindow.focus();
    return officeWindow;
  }

  officeWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 980,
    minHeight: 700,
    title: "Microsoft Word",
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    parent: mainWindow || undefined,
    webPreferences: {
      contextIsolation: true,
      partition: `temporary:edurev-office-${Date.now()}`,
      sandbox: true,
    },
  });

  officeWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isMicrosoftOfficeInAppUrl(url)) {
      createOfficeWindow(url);
      return { action: "deny" };
    }

    if (isInternalWrapperUrl(url)) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(url);
        focusMainWindow();
      }
      return { action: "deny" };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });

  officeWindow.webContents.on("will-navigate", (event, url) => {
    if (isMicrosoftOfficeInAppUrl(url)) {
      return;
    }

    if (isInternalWrapperUrl(url)) {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(url);
        focusMainWindow();
      }
      officeWindow?.close();
      return;
    }

    event.preventDefault();
    shell.openExternal(url);
  });

  officeWindow.on("closed", () => {
    officeWindow = null;
    focusMainWindow();
  });

  officeWindow.loadURL(targetUrl);
  return officeWindow;
}

function routeDeepLinkToApp(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== `${CUSTOM_PROTOCOL}:`) {
      return false;
    }

    const payload = parsed.searchParams.get("payload");
    const appUrl = payload
      ? `${APP_ORIGIN}/auth/desktop-complete?payload=${encodeURIComponent(payload)}`
      : APP_URL;

    if (mainWindow) {
      focusMainWindow();
      mainWindow.webContents.session.clearCache().catch(() => {});
      mainWindow.loadURL(withFreshShellQuery(appUrl));
    } else {
      pendingDeepLink = withFreshShellQuery(appUrl);
    }
    return true;
  } catch {
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    title: APP_NAME,
    backgroundColor: "#f7fbff",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow = win;

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isMicrosoftOfficeInAppUrl(url)) {
      createOfficeWindow(url);
      return { action: "deny" };
    }
    if (isGoogleInAppUrl(url) && embeddedGoogleView) {
      embeddedGoogleView.webContents.loadURL(url);
      return { action: "deny" };
    }

    if (isAllowedAuthPopupUrl(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (isInternalWrapperUrl(url)) {
      return;
    }
    if (isMicrosoftOfficeInAppUrl(url)) {
      event.preventDefault();
      createOfficeWindow(url);
      return;
    }
    if (isGoogleInAppUrl(url) && embeddedGoogleView) {
      event.preventDefault();
      embeddedGoogleView.webContents.loadURL(url);
      return;
    }
    if (!isInternalWrapperUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.on("closed", () => {
    closeEmbeddedWordView();
    closeEmbeddedGoogleView();
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  win.webContents.session.clearCache().catch(() => {});
  win.loadURL(withFreshShellQuery(pendingDeepLink || APP_URL));
  pendingDeepLink = null;

  win.on("focus", () => {
    win.webContents.session.clearCache().catch(() => {});
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const deepLink = argv.find((arg) => typeof arg === "string" && arg.startsWith(`${CUSTOM_PROTOCOL}://`));
    if (deepLink) {
      routeDeepLinkToApp(deepLink);
      return;
    }
    focusMainWindow();
  });
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  routeDeepLinkToApp(url);
});

app.whenReady().then(() => {
  app.setName(APP_NAME);
  app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL);
  if (process.platform === "darwin" && app.dock) {
    try {
      app.dock.setIcon(DOCK_ICON);
    } catch {}
  }

  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-navigate", (event, url) => {
      const isEmbeddedGoogleContents = embeddedGoogleView && contents.id === embeddedGoogleView.webContents.id;
      if (isInternalWrapperUrl(url) || isMicrosoftOfficeInAppUrl(url) || isGoogleInAppUrl(url) || isEmbeddedGoogleContents) {
        return;
      }
      event.preventDefault();
      shell.openExternal(url);
    });
  });

  createWindow();

  ipcMain.on("word-online:open", (_event, payload) => {
    if (!payload?.url) return;
    openEmbeddedWordView(payload.url, payload.bounds || {});
  });

  ipcMain.on("word-online:update-bounds", (_event, bounds) => {
    updateEmbeddedWordBounds(bounds || {});
  });

  ipcMain.on("word-online:close", () => {
    closeEmbeddedWordView();
  });

  ipcMain.on("google-page:open", (_event, payload) => {
    if (!payload?.url) return;
    openEmbeddedGoogleView(payload.url, payload.bounds || {});
  });

  ipcMain.on("google-page:update-bounds", (_event, bounds) => {
    updateEmbeddedGoogleBounds(bounds || {});
  });

  ipcMain.on("google-page:close", () => {
    closeEmbeddedGoogleView();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      return;
    }
    focusMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
