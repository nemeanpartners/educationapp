const APP_URL = "https://edurevolution-ai-wyxvlktr5q-uw.a.run.app";
const AUTH_URL = `${APP_URL}/auth`;

async function openUrl(url) {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({
    url,
    presentationStyle: "fullscreen"
  });
}

document
  .getElementById("open-app")
  ?.addEventListener("click", () => openUrl(APP_URL));

document
  .getElementById("open-auth")
  ?.addEventListener("click", () => openUrl(AUTH_URL));
