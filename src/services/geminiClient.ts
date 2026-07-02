function normalizeKey(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed === "undefined" || trimmed === "null") return "";
  return trimmed;
}

export function getGeminiApiKey(): string {
  const envKey = normalizeKey(import.meta.env.VITE_GEMINI_API_KEY);
  if (envKey) return envKey;

  if (typeof window !== "undefined") {
    const w = window as unknown as { __APP_CONFIG__?: { geminiApiKey?: string } };
    const configKey = normalizeKey(w.__APP_CONFIG__?.geminiApiKey);
    if (configKey) return configKey;
    try {
      const stored = normalizeKey(window.localStorage.getItem("gemini_api_key"));
      return stored || "";
    } catch {
      return "";
    }
  }

  return "";
}
