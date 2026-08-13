const path = require("path");
const { app, BrowserWindow, shell, ipcMain, BrowserView, Menu } = require("electron");

const APP_ORIGIN = "https://www.educationrevolution.qld.one";
const APP_URL = `${APP_ORIGIN}/auth?shell=macos`;
const FIREBASE_AUTH_ORIGIN = "https://studio-7677496479-873b4.firebaseapp.com";
const CUSTOM_PROTOCOL = "edurevolutionai";
const APP_NAME = "EducationRev";
const DOCK_ICON = path.join(__dirname, "build", "icon-1024.png");
const LOADING_PAGE = path.join(__dirname, "loading.html");
const SHELL_PAGE_PREFIX = "data:text/html;charset=utf-8,";
const LOAD_TIMEOUT_MS = 20000;
const BLANK_CHECK_DELAY_MS = 4500;
const RENDER_POLL_INTERVAL_MS = 450;
const MINIMUM_STARTUP_LOADING_MS = 1200;

let mainWindow = null;
let officeWindow = null;
let embeddedWordView = null;
let embeddedGoogleView = null;
let pendingDeepLink = null;
let wordSessionNonce = Date.now();
let mainWindowLoadToken = 0;
let isQuitting = false;
let shellPageToken = 0;

app.commandLine.appendSwitch("disable-http-cache");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createShellPageUrl({ title, message, detail = "", mode = "loading" }) {
  const isError = mode === "error";
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeDetail = escapeHtml(detail);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: linear-gradient(180deg, #f8fbff 0%, #eef5fb 100%);
      color: #111827;
    }
    main {
      width: min(560px, calc(100vw - 48px));
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.10);
      padding: 34px;
      text-align: center;
    }
    img { width: 74px; height: 74px; object-fit: contain; }
    h1 { margin: 18px 0 10px; font-size: 30px; line-height: 1.1; letter-spacing: 0; }
    p { margin: 0 auto; max-width: 440px; color: #4b5563; font-size: 15px; line-height: 1.55; font-weight: 600; }
    .detail { margin-top: 14px; color: #6b7280; font-size: 13px; overflow-wrap: anywhere; }
    .spinner {
      width: 34px;
      height: 34px;
      margin: 22px auto 0;
      border: 4px solid #dbeafe;
      border-top-color: #4f46e5;
      border-radius: 999px;
      animation: spin 0.9s linear infinite;
    }
    .actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 24px; }
    button {
      appearance: none;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      background: #ffffff;
      color: #111827;
      font: inherit;
      font-size: 14px;
      font-weight: 800;
      padding: 11px 15px;
      cursor: pointer;
    }
    button.primary { border-color: #4f46e5; background: #4f46e5; color: white; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <main>
    <img src="${APP_ORIGIN}/edurevlogoimage.png" alt="">
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    ${safeDetail ? `<p class="detail">${safeDetail}</p>` : ""}
    ${isError ? `
      <div class="actions">
        <button class="primary" type="button" onclick="window.eduRevShell && window.eduRevShell.reloadApp()">Try Again</button>
        <button type="button" onclick="window.eduRevShell && window.eduRevShell.openAppInBrowser()">Open in Browser</button>
      </div>
    ` : '<div class="spinner" aria-label="Loading"></div>'}
  </main>
</body>
</html>`;
  return `${SHELL_PAGE_PREFIX}${encodeURIComponent(html)}`;
}

function showShellLoading(win) {
  shellPageToken += 1;
  return win.loadFile(LOADING_PAGE).catch(() => {
    return win.loadURL(createShellPageUrl({
      title: `Opening ${APP_NAME}`,
      message: "Loading the EducationRev sign-in workspace.",
    })).catch(() => {});
  });
}

function showShellError(win, detail) {
  shellPageToken += 1;
  win.loadURL(createShellPageUrl({
    mode: "error",
    title: `${APP_NAME} could not finish loading`,
    message: "The app window is working, but the EducationRev web workspace did not render correctly. Check your connection, then try again.",
    detail,
  })).catch(() => {});
}

function isInternalWrapperUrl(url) {
  return url.startsWith(APP_ORIGIN) || url.startsWith(FIREBASE_AUTH_ORIGIN);
}

function isShellPageUrl(url) {
  return url.startsWith(SHELL_PAGE_PREFIX) || url.includes("/loading.html");
}

function isCurrentShellPage(win) {
  return !!win && !win.isDestroyed() && isShellPageUrl(win.webContents.getURL() || "");
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
      host === "studio-7677496479-873b4.firebaseapp.com" ||
      host.endsWith(".firebaseapp.com") ||
      host === "www.educationrevolution.qld.one"
    );
  } catch {
    return false;
  }
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function showMainWindow() {
  focusMainWindow();
}

function buildApplicationMenu() {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        { role: "about", label: `About ${APP_NAME}` },
        { type: "separator" },
        {
          label: `Show ${APP_NAME}`,
          accelerator: "CommandOrControl+0",
          click: showMainWindow,
        },
        {
          label: "Reload Workspace",
          accelerator: "CommandOrControl+R",
          click: () => loadMainApp(),
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit", label: `Quit ${APP_NAME}` },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: `Open ${APP_NAME} Window`,
          accelerator: "CommandOrControl+N",
          click: showMainWindow,
        },
        {
          label: "Open Sign-In in Browser",
          click: () => shell.openExternal(APP_URL),
        },
        { type: "separator" },
        { role: "close" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        {
          label: `Show ${APP_NAME}`,
          accelerator: "CommandOrControl+0",
          click: showMainWindow,
        },
        { type: "separator" },
        { role: "minimize" },
        { role: "zoom" },
        { role: "front" },
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: `${APP_NAME} Website`,
          click: () => shell.openExternal(APP_ORIGIN),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
      loadMainApp(withFreshShellQuery(appUrl));
    } else {
      pendingDeepLink = withFreshShellQuery(appUrl);
    }
    return true;
  } catch {
    return false;
  }
}

async function clearLaunchCaches(win) {
  const session = win.webContents.session;
  await Promise.allSettled([
    session.clearCache(),
    session.clearStorageData({
      storages: ["serviceworkers", "cachestorage"],
      origin: APP_ORIGIN,
    }),
  ]);
}

async function inspectRenderedPage(win) {
  if (!win || win.isDestroyed()) return null;
  return win.webContents.executeJavaScript(`
    (() => {
      const root = document.getElementById('root');
      const bodyClone = document.body ? document.body.cloneNode(true) : null;
      if (bodyClone) {
        const shellOverlay = bodyClone.querySelector('#edurev-native-loading-overlay');
        if (shellOverlay) shellOverlay.remove();
      }
      const bodyText = (bodyClone && bodyClone.innerText || '').trim();
      const visibleText = bodyText.replace(/\\s+/g, ' ');
      const rootChildren = root ? root.childElementCount : -1;
      const bodyChildren = bodyClone ? bodyClone.childElementCount : -1;
      return {
        href: window.location.href,
        title: document.title,
        textLength: visibleText.length,
        textPreview: visibleText.slice(0, 160),
        rootChildren,
        bodyChildren,
        readyState: document.readyState
      };
    })()
  `, true);
}

function showNativeLoadingOverlay(win, detail = "") {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("native-loading:show", detail);
}

function hideNativeLoadingOverlay(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("native-loading:hide");
}

function showNativeLoadingError(win, detail = "") {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("native-loading:error", detail);
}

function hasVisibleAppContent(state) {
  if (!state) return false;
  return (
    state.textLength > 20 ||
    state.rootChildren > 0 ||
    state.bodyChildren > 1
  );
}

async function verifyMainPageRendered(win, token, reason, { retryOnBlank = true } = {}) {
  if (!win || win.isDestroyed() || mainWindowLoadToken !== token) return;
  const currentUrl = win.webContents.getURL();
  if (isShellPageUrl(currentUrl) || !isInternalWrapperUrl(currentUrl)) return;

  try {
    const state = await inspectRenderedPage(win);
    if (!state || mainWindowLoadToken !== token) return;
    if (hasVisibleAppContent(state)) {
      hideNativeLoadingOverlay(win);
      return true;
    }

    const retryCount = win.__eduRevRetryCount || 0;
    if (retryOnBlank && retryCount < 1) {
      win.__eduRevRetryCount = retryCount + 1;
      loadMainApp(currentUrl);
      return false;
    }

    showNativeLoadingError(win, `The app page loaded without visible content after ${reason}.`);
    return false;
  } catch (error) {
    showNativeLoadingError(win, error?.message || `The app could not be inspected after ${reason}.`);
    return false;
  }
}

function pollUntilMainPageRendered(win, token) {
  const startedAt = Date.now();
  const poll = async () => {
    if (!win || win.isDestroyed() || mainWindowLoadToken !== token) return;
    const rendered = await verifyMainPageRendered(win, token, "startup rendering", {
      retryOnBlank: false,
    });
    if (rendered) return;
    if (Date.now() - startedAt >= LOAD_TIMEOUT_MS) {
      await verifyMainPageRendered(win, token, "the startup timeout", {
        retryOnBlank: true,
      });
      return;
    }
    setTimeout(poll, RENDER_POLL_INTERVAL_MS);
  };
  setTimeout(poll, RENDER_POLL_INTERVAL_MS);
}

function loadMainApp(targetUrl = pendingDeepLink || APP_URL) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingDeepLink = targetUrl;
    createWindow();
    return;
  }

  const win = mainWindow;
  const loadToken = Date.now();
  mainWindowLoadToken = loadToken;
  const freshUrl = withFreshShellQuery(targetUrl || APP_URL);

  showShellLoading(win)
    .then(() => {
      if (!win.isDestroyed() && !win.isVisible()) {
        win.show();
      }
      return new Promise((resolve) => setTimeout(resolve, MINIMUM_STARTUP_LOADING_MS));
    })
    .then(() => clearLaunchCaches(win))
    .catch(() => {})
    .finally(() => {
      if (win.isDestroyed() || mainWindowLoadToken !== loadToken) return;
      win.loadURL(freshUrl).catch((error) => {
        if (mainWindowLoadToken === loadToken) {
          showShellError(win, error?.message || "The app URL could not be opened.");
        }
      });
    });

  setTimeout(() => {
    verifyMainPageRendered(win, loadToken, "the startup timeout");
  }, LOAD_TIMEOUT_MS);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    title: APP_NAME,
    show: false,
    backgroundColor: "#f7fbff",
    autoHideMenuBar: false,
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
    if (isShellPageUrl(url)) {
      return;
    }
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

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    const failedUrl = validatedUrl || win.webContents.getURL() || "";
    if (!isMainFrame || errorCode === -3 || isShellPageUrl(failedUrl) || isCurrentShellPage(win)) return;
    if (isInternalWrapperUrl(failedUrl)) {
      showNativeLoadingError(win, `${errorDescription || "Load failed"} (${errorCode})`);
    }
  });

  win.webContents.on("dom-ready", () => {
    if (isCurrentShellPage(win)) return;
    const token = mainWindowLoadToken;
    showNativeLoadingOverlay(win);
    setTimeout(() => {
      verifyMainPageRendered(win, token, "document readiness", {
        retryOnBlank: false,
      });
    }, RENDER_POLL_INTERVAL_MS);
  });

  win.webContents.on("did-finish-load", () => {
    if (isCurrentShellPage(win)) return;
    const token = mainWindowLoadToken;
    showNativeLoadingOverlay(win);
    pollUntilMainPageRendered(win, token);
    setTimeout(() => {
      verifyMainPageRendered(win, token, "page load completion");
    }, BLANK_CHECK_DELAY_MS);
  });

  win.on("close", (event) => {
    if (process.platform === "darwin" && !isQuitting) {
      event.preventDefault();
      closeEmbeddedWordView();
      closeEmbeddedGoogleView();
      win.hide();
    }
  });

  win.on("closed", () => {
    closeEmbeddedWordView();
    closeEmbeddedGoogleView();
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  loadMainApp(pendingDeepLink || APP_URL);
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

app.on("before-quit", () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  app.setName(APP_NAME);
  buildApplicationMenu();
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

  ipcMain.on("app:reload", () => {
    loadMainApp();
  });

  ipcMain.on("app:open-browser", () => {
    shell.openExternal(APP_URL);
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
