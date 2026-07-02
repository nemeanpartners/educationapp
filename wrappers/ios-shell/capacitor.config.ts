import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ai.edurevolution.wrapper.ios",
  appName: "EduRevolution AI",
  webDir: "dist",
  server: {
    url: "https://edurevolution-ai-wyxvlktr5q-uw.a.run.app/auth",
    cleartext: false
  },
  ios: {
    contentInset: "always",
    preferredContentMode: "mobile"
  }
};

export default config;
