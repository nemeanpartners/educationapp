const { contextBridge, ipcRenderer } = require("electron");

const OVERLAY_ID = "edurev-native-loading-overlay";

function ensureLoadingOverlay(mode = "loading", detail = "") {
  if (typeof document === "undefined") return;

  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("role", mode === "error" ? "alert" : "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `
      <style>
        #${OVERLAY_ID} {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: grid;
          place-items: center;
          background: linear-gradient(180deg, #f8fbff 0%, #eef5fb 100%);
          color: #111827;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        #${OVERLAY_ID} .edurev-card {
          width: min(560px, calc(100vw - 48px));
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 24px 80px rgba(15, 23, 42, 0.10);
          padding: 34px;
          text-align: center;
        }
        #${OVERLAY_ID} img {
          width: 74px;
          height: 74px;
          object-fit: contain;
        }
        #${OVERLAY_ID} h1 {
          margin: 18px 0 10px;
          font-size: 30px;
          line-height: 1.1;
          letter-spacing: 0;
        }
        #${OVERLAY_ID} p {
          margin: 0 auto;
          max-width: 440px;
          color: #4b5563;
          font-size: 15px;
          line-height: 1.55;
          font-weight: 600;
        }
        #${OVERLAY_ID} .edurev-detail {
          margin-top: 14px;
          color: #6b7280;
          font-size: 13px;
          overflow-wrap: anywhere;
        }
        #${OVERLAY_ID} .edurev-spinner {
          width: 34px;
          height: 34px;
          margin: 22px auto 0;
          border: 4px solid #dbeafe;
          border-top-color: #4f46e5;
          border-radius: 999px;
          animation: edurev-spin 0.9s linear infinite;
        }
        #${OVERLAY_ID} .edurev-actions {
          display: none;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 24px;
        }
        #${OVERLAY_ID}[data-mode="error"] .edurev-spinner { display: none; }
        #${OVERLAY_ID}[data-mode="error"] .edurev-actions { display: flex; }
        #${OVERLAY_ID} button {
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
        #${OVERLAY_ID} button.primary {
          border-color: #4f46e5;
          background: #4f46e5;
          color: white;
        }
        @keyframes edurev-spin { to { transform: rotate(360deg); } }
      </style>
      <main class="edurev-card">
        <img src="https://www.educationrevolution.qld.one/edurevlogoimage.png" alt="">
        <h1></h1>
        <p class="edurev-message"></p>
        <p class="edurev-detail"></p>
        <div class="edurev-spinner" aria-label="Loading"></div>
        <div class="edurev-actions">
          <button class="primary" type="button" data-action="reload">Try Again</button>
          <button type="button" data-action="browser">Open in Browser</button>
        </div>
      </main>
    `;
    document.documentElement.appendChild(overlay);
    overlay.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("button[data-action]") : null;
      if (!button) return;
      if (button.dataset.action === "reload") {
        ipcRenderer.send("app:reload");
      }
      if (button.dataset.action === "browser") {
        ipcRenderer.send("app:open-browser");
      }
    });
  }

  overlay.dataset.mode = mode;
  overlay.querySelector("h1").textContent =
    mode === "error" ? "EducationRev could not finish loading" : "Opening EducationRev";
  overlay.querySelector(".edurev-message").textContent =
    mode === "error"
      ? "The app window is working, but the EducationRev workspace did not render correctly. Check your connection, then try again."
      : "Loading the EducationRev sign-in workspace.";
  overlay.querySelector(".edurev-detail").textContent = detail || "";
}

function hideLoadingOverlay() {
  const overlay = typeof document === "undefined" ? null : document.getElementById(OVERLAY_ID);
  if (overlay) overlay.remove();
}

function initializeLoadingOverlay() {
  if (typeof window === "undefined") return;
  const protocol = window.location && window.location.protocol;
  if (protocol === "http:" || protocol === "https:") {
    ensureLoadingOverlay("loading");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeLoadingOverlay, { once: true });
} else {
  initializeLoadingOverlay();
}

ipcRenderer.on("native-loading:show", (_event, detail) => {
  ensureLoadingOverlay("loading", detail || "");
});

ipcRenderer.on("native-loading:error", (_event, detail) => {
  ensureLoadingOverlay("error", detail || "");
});

ipcRenderer.on("native-loading:hide", () => {
  hideLoadingOverlay();
});

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
  reloadApp() {
    ipcRenderer.send("app:reload");
  },
  openAppInBrowser() {
    ipcRenderer.send("app:open-browser");
  },
});
