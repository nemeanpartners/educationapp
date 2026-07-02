import { getGeminiApiKey } from "./geminiClient";
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

const HARDCODED_GEMINI_KEY = "AIzaSyBO3CFycSOZhuik9pO3ms_rNKedTFBGPSg";

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

function getResolvedGeminiKey() {
  return getGeminiApiKey() || HARDCODED_GEMINI_KEY;
}

function normalizeContents(contents: any) {
  if (typeof contents === "string") {
    return [
      {
        role: "user",
        parts: [{ text: contents }],
      },
    ];
  }

  if (Array.isArray(contents)) {
    return contents;
  }

  if (contents && typeof contents === "object") {
    return [contents];
  }

  return [
    {
      role: "user",
      parts: [{ text: String(contents ?? "") }],
    },
  ];
}

function buildGenerationConfig(config?: any) {
  if (!config) return undefined;
  const {
    systemInstruction,
    responseMimeType,
    responseSchema,
    thinkingConfig,
    ...rest
  } = config;

  return {
    ...rest,
    ...(responseMimeType ? { responseMimeType } : {}),
    ...(responseSchema ? { responseSchema } : {}),
    ...(thinkingConfig ? { thinkingConfig } : {}),
  };
}

function extractTextFromResponse(data: any) {
  if (typeof data?.text === "string" && data.text) {
    return data.text;
  }

  const candidateParts = data?.candidates?.flatMap((candidate: any) => candidate?.content?.parts || []) || [];
  const joined = candidateParts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n");

  return joined;
}

function formatDirectGeminiError(status: number, data: any) {
  const message =
    typeof data?.error?.message === "string"
      ? data.error.message
      : `Gemini request failed (${status})`;
  const err = new Error(message) as Error & { status?: number };
  err.status = status;
  throw err;
}

async function postGeminiDirect(body: any, model: string): Promise<GeminiResponse> {
  const key = getResolvedGeminiKey();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${normalizeModel(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    formatDirectGeminiError(response.status, data);
  }

  return {
    text: extractTextFromResponse(data),
    candidates: data?.candidates || [],
  };
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

  const directKey = getResolvedGeminiKey();
  if (directKey) {
    try {
      if (payload.mode === "chat") {
        const contents = [
          ...(Array.isArray(payload.history) ? payload.history : []),
          {
            role: "user",
            parts: [{ text: payload.message || "" }],
          },
        ];

        return await postGeminiDirect(
          {
            contents,
            ...(payload.systemInstruction
              ? {
                  system_instruction: {
                    parts: [{ text: payload.systemInstruction }],
                  },
                }
              : {}),
            ...(payload.config ? { generationConfig: buildGenerationConfig(payload.config) } : {}),
          },
          payload.model,
        );
      }

      return await postGeminiDirect(
        {
          contents: normalizeContents(payload.contents),
          ...(payload.config ? { generationConfig: buildGenerationConfig(payload.config) } : {}),
        },
        payload.model,
      );
    } catch (error) {
      const status = (error as Error & { status?: number })?.status;
      if (status && status >= 400 && status < 500) {
        throw error;
      }
      console.error("Direct Gemini request failed, falling back to server proxy:", error);
    }
  }

  return postGeminiServer(payload);
}

export async function geminiGenerateContent(request: GeminiGenerateRequest): Promise<GeminiResponse> {
  return postGemini({ mode: "generateContent", ...request });
}

export async function geminiChat(request: GeminiChatRequest): Promise<GeminiResponse> {
  return postGemini({ mode: "chat", ...request });
}
