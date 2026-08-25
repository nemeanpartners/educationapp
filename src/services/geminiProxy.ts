import { auth } from "../firebase";

type GeminiGenerateRequest = {
  model: string;
  contents: any;
  config?: any;
};

type GeminiChatRequest = {
  model: string;
  message: string;
  history?: any[];
  systemInstruction?: string;
  config?: any;
};

type GeminiResponse = {
  text: string;
  candidates?: any[];
};

export const GUEST_AI_BLOCK_MESSAGE = "Guest users cannot use AI features. Create an account or sign in to continue.";

function normalizeModel(model: string) {
  switch (model) {
    case "gemini-3-flash-preview":
      return "gemini-2.5-flash";
    case "gemini-3.1-pro-preview":
      return "gemini-2.5-pro";
    default:
      return model;
  }
}

async function postGeminiServer(payload: any): Promise<GeminiResponse> {
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : `Gemini request failed (${response.status})`;
    const err = new Error(message) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  return {
    text: data?.text || "",
    candidates: data?.candidates || [],
  };
}

async function postGemini(payload: any): Promise<GeminiResponse> {
  if (auth.currentUser?.isAnonymous) {
    throw new Error(GUEST_AI_BLOCK_MESSAGE);
  }

  return postGeminiServer({
    ...payload,
    model: normalizeModel(payload.model),
  });
}

export async function geminiGenerateContent(request: GeminiGenerateRequest): Promise<GeminiResponse> {
  return postGemini({ mode: "generateContent", ...request });
}

export async function geminiChat(request: GeminiChatRequest): Promise<GeminiResponse> {
  return postGemini({ mode: "chat", ...request });
}
