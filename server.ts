import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { execFile } from "child_process";
import { promisify } from "util";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const execFileAsync = promisify(execFile);

const runtimeFile = process.argv[1] || "";
const __dirname = runtimeFile ? path.dirname(runtimeFile) : process.cwd();
const firebaseAppletConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseAppletConfig = fs.existsSync(firebaseAppletConfigPath)
  ? JSON.parse(fs.readFileSync(firebaseAppletConfigPath, "utf8"))
  : {};
const firebaseProjectId = String(
  process.env.FIREBASE_PROJECT_ID ||
  firebaseAppletConfig.projectId ||
  "",
).trim();
const firebaseWebApiKey = String(
  process.env.FIREBASE_WEB_API_KEY ||
  process.env.VITE_FIREBASE_API_KEY ||
  firebaseAppletConfig.apiKey ||
  "",
).trim();
const firestoreDatabaseId = String(
  firebaseAppletConfig.firestoreDatabaseId ||
  "default",
).trim();
const microsoftScopes = String(
  process.env.MICROSOFT_SCOPES ||
  "openid profile email offline_access User.Read Files.ReadWrite Files.ReadWrite.All",
)
  .split(/\s+/)
  .filter(Boolean);

// Prefer built assets in /workspace/dist when available.
const distCandidate = path.join(process.cwd(), "dist");
const fallbackDist = __dirname;
const distPath = fs.existsSync(path.join(distCandidate, "index.html"))
  ? distCandidate
  : fallbackDist;

console.log(`Serving static files from: ${distPath}`);

app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

app.use(express.json({ limit: "25mb" }));
app.use(express.static(distPath));

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#xA;/g, "\n")
    .replace(/&#xD;/g, "\r")
    .replace(/&#x9;/g, "\t");
}

function extractReadableTextFromOfficeXml(xml: string) {
  const withLineBreaks = xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/a:p>/g, "\n")
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<a:tab[^>]*\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n");

  const withoutTags = withLineBreaks.replace(/<[^>]+>/g, " ");
  return decodeXmlEntities(withoutTags)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function tryParseGeminiErrorPayload(message: string) {
  try {
    return JSON.parse(message);
  } catch {
    return null;
  }
}

function readGeminiRetrySeconds(message: string, payload: any) {
  const joined = [message, payload?.error?.message, payload?.message]
    .filter((value) => typeof value === "string")
    .join(" ");
  const match = joined.match(/retry in\s+([\d.]+)s/i);
  return match ? Math.ceil(Number(match[1])) : null;
}

function formatGeminiError(error: unknown) {
  const rawMessage =
    typeof (error as any)?.message === "string"
      ? (error as any).message
      : "Gemini request failed.";
  const payload = tryParseGeminiErrorPayload(rawMessage);
  const payloadStatus = Number(payload?.error?.code || payload?.code || 0);
  const text = [rawMessage, payload?.error?.message, payload?.status, payload?.error?.status]
    .filter((value) => typeof value === "string" || typeof value === "number")
    .join(" ");

  const isQuotaError =
    payloadStatus === 429 ||
    /RESOURCE_EXHAUSTED|quota exceeded|rate.?limit|429/i.test(text);

  if (isQuotaError) {
    const retrySeconds = readGeminiRetrySeconds(rawMessage, payload);
    return {
      status: 429,
      message: retrySeconds
        ? `Lecture Lift is temporarily busy. Wait about ${retrySeconds} seconds, then try again.`
        : "Lecture Lift is temporarily busy. Please wait a moment, then try again.",
    };
  }

  if (/UNAVAILABLE|503/i.test(text)) {
    return {
      status: 503,
      message: "Lecture Lift is temporarily unavailable. Please try again in a moment.",
    };
  }

  if (/API key|api key|permission|forbidden|unauthorized/i.test(text)) {
    return {
      status: 500,
      message: "Lecture Lift could not reach the AI service configuration.",
    };
  }

  return {
    status: payloadStatus || 500,
    message: typeof payload?.error?.message === "string" && payload.error.message.trim()
      ? payload.error.message.trim()
      : rawMessage,
  };
}

function base64UrlEncode(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeJwtPayload(token?: string | null) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}

type VerifiedFirebaseUser = {
  uid: string;
  email?: string;
};

type MicrosoftConnectionRecord = {
  userId: string;
  microsoftUserId: string;
  microsoftEmail?: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  expiresAt: string;
  scope: string;
  updatedAt: string;
  createdAt?: string;
};

function requireFirebaseProjectId() {
  if (!firebaseProjectId) {
    throw new Error("Missing Firebase project configuration.");
  }
  return firebaseProjectId;
}

function requireFirebaseWebApiKey() {
  if (!firebaseWebApiKey) {
    throw new Error("Missing Firebase Web API key configuration.");
  }
  return firebaseWebApiKey;
}

function getFirestoreRestBaseUrl() {
  const databaseId = firestoreDatabaseId === "default" ? "(default)" : firestoreDatabaseId;
  return `https://firestore.googleapis.com/v1/projects/${requireFirebaseProjectId()}/databases/${databaseId}/documents`;
}

function encodeFirestoreValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => encodeFirestoreValue(item)) } };
  }
  if (typeof value === "object") {
    const fields: Record<string, any> = {};
    Object.entries(value).forEach(([key, entry]) => {
      fields[key] = encodeFirestoreValue(entry);
    });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function decodeFirestoreValue(value: any): any {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) {
    return Array.isArray(value.arrayValue?.values)
      ? value.arrayValue.values.map((entry: any) => decodeFirestoreValue(entry))
      : [];
  }
  if ("mapValue" in value) {
    const output: Record<string, any> = {};
    const fields = value.mapValue?.fields || {};
    Object.entries(fields).forEach(([key, entry]) => {
      output[key] = decodeFirestoreValue(entry);
    });
    return output;
  }
  return null;
}

function decodeFirestoreDocumentFields(fields: Record<string, any> | undefined) {
  const decoded: Record<string, any> = {};
  Object.entries(fields || {}).forEach(([key, value]) => {
    decoded[key] = decodeFirestoreValue(value);
  });
  return decoded;
}

function requireMicrosoftEnv(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required Microsoft environment variable: ${name}`);
  }
  return value;
}

function getMicrosoftTokenEndpoint() {
  const tenantId = requireMicrosoftEnv("MICROSOFT_TENANT_ID");
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

function getMicrosoftAuthorizeEndpoint() {
  const tenantId = requireMicrosoftEnv("MICROSOFT_TENANT_ID");
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
}

function getMicrosoftRedirectUri() {
  return requireMicrosoftEnv("MICROSOFT_REDIRECT_URI");
}

function getMicrosoftCryptoSecret() {
  return String(
    process.env.MICROSOFT_TOKEN_ENCRYPTION_SECRET ||
    process.env.MICROSOFT_CLIENT_SECRET ||
    "",
  ).trim();
}

function getMicrosoftCryptoKey() {
  const secret = getMicrosoftCryptoSecret();
  if (!secret) {
    throw new Error("Missing MICROSOFT_TOKEN_ENCRYPTION_SECRET or MICROSOFT_CLIENT_SECRET for token protection.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptSecretValue(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getMicrosoftCryptoKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [base64UrlEncode(iv), base64UrlEncode(authTag), base64UrlEncode(encrypted)].join(".");
}

function decryptSecretValue(payload: string) {
  const [ivPart, authTagPart, encryptedPart] = String(payload || "").split(".");
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("Stored Microsoft token payload is malformed.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getMicrosoftCryptoKey(),
    Buffer.from(ivPart.replace(/-/g, "+").replace(/_/g, "/"), "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagPart.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart.replace(/-/g, "+").replace(/_/g, "/"), "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function getMicrosoftStateSecret() {
  const base = getMicrosoftCryptoSecret();
  if (!base) {
    throw new Error("Missing Microsoft secret configuration.");
  }
  return crypto.createHash("sha256").update(`ms-state:${base}`).digest();
}

function signMicrosoftState(payload: Record<string, unknown>) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", getMicrosoftStateSecret()).update(body).digest();
  return `${body}.${base64UrlEncode(sig)}`;
}

function verifyMicrosoftState(token: string) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) {
    throw new Error("Missing Microsoft OAuth state.");
  }
  const expected = base64UrlEncode(crypto.createHmac("sha256", getMicrosoftStateSecret()).update(body).digest());
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Microsoft OAuth state validation failed.");
  }
  const payload = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  if (!payload?.exp || Number(payload.exp) < Date.now()) {
    throw new Error("Microsoft OAuth state expired.");
  }
  return payload as {
    uid: string;
    returnTo: string;
    exp: number;
    appToken: string;
    launchWord?: boolean;
    workbookType?: string;
  };
}

function normalizeReturnTo(value: string | null | undefined) {
  const fallback = "/workbooks/microsoft-word";
  if (!value) return fallback;
  if (value.startsWith("/")) {
    if (value.startsWith("//")) return fallback;
    return value;
  }
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const isProductionHost = hostname === "edurevolution-ai-wyxvlktr5q-uw.a.run.app";
    if ((parsed.protocol === "http:" && isLocalhost) || (parsed.protocol === "https:" && isProductionHost)) {
      return parsed.toString();
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function getRequestOrigin(req: express.Request) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "https";
  const host = String(req.headers["x-forwarded-host"] || req.get("host") || "").split(",")[0].trim();
  return host ? `${protocol}://${host}` : "";
}

async function verifyFirebaseUserToken(idToken: string): Promise<VerifiedFirebaseUser> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(requireFirebaseWebApiKey())}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(
      new Error(payload?.error?.message || "Could not verify Firebase sign-in."),
      { status: 401 },
    );
  }
  const user = Array.isArray(payload?.users) ? payload.users[0] : null;
  if (!user?.localId) {
    throw Object.assign(new Error("Firebase sign-in is invalid."), { status: 401 });
  }
  return {
    uid: String(user.localId),
    email: typeof user.email === "string" ? user.email : undefined,
  };
}

function readBearerToken(req: express.Request) {
  const authHeader = String(req.headers.authorization || "");
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function firestoreAuthedRequest(
  userIdToken: string,
  documentPath: string,
  init: RequestInit = {},
) {
  const url = documentPath.startsWith("http")
    ? documentPath
    : `${getFirestoreRestBaseUrl()}/${documentPath}`;
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${userIdToken}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message =
      errorPayload?.error?.message ||
      errorPayload?.error?.status ||
      `Firestore request failed with status ${response.status}.`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return response;
}

async function requireAuthenticatedAppUser(req: express.Request) {
  const token = readBearerToken(req);
  if (!token) {
    throw Object.assign(new Error("Missing Firebase bearer token."), { status: 401 });
  }
  const user = await verifyFirebaseUserToken(token);
  return { ...user, idToken: token };
}

async function graphRequest(accessToken: string, input: string, init: RequestInit = {}) {
  const url = input.startsWith("http") ? input : `https://graph.microsoft.com/v1.0${input}`;
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw Object.assign(
      new Error(errorText || `Microsoft Graph request failed with status ${response.status}.`),
      { status: response.status },
    );
  }
  return response;
}

async function exchangeMicrosoftCode(code: string) {
  const body = new URLSearchParams({
    client_id: requireMicrosoftEnv("MICROSOFT_CLIENT_ID"),
    client_secret: requireMicrosoftEnv("MICROSOFT_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: getMicrosoftRedirectUri(),
    scope: microsoftScopes.join(" "),
  });

  const response = await fetch(getMicrosoftTokenEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.error || "Microsoft token exchange failed.");
  }
  return payload as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
  };
}

async function refreshMicrosoftTokens(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: requireMicrosoftEnv("MICROSOFT_CLIENT_ID"),
    client_secret: requireMicrosoftEnv("MICROSOFT_CLIENT_SECRET"),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    redirect_uri: getMicrosoftRedirectUri(),
    scope: microsoftScopes.join(" "),
  });

  const response = await fetch(getMicrosoftTokenEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.error || "Microsoft token refresh failed.");
  }
  return payload as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
}

function getMicrosoftConnectionDocumentPath(userId: string) {
  return `microsoftConnections/${encodeURIComponent(userId)}`;
}

async function saveMicrosoftConnection(userId: string, appUserToken: string, payload: {
  microsoftUserId: string;
  microsoftEmail?: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope?: string;
}) {
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + Math.max(60, Number(payload.expiresIn || 0)) * 1000).toISOString();
  const fields = {
    userId,
    microsoftUserId: payload.microsoftUserId,
    microsoftEmail: payload.microsoftEmail || "",
    accessTokenEncrypted: encryptSecretValue(payload.accessToken),
    refreshTokenEncrypted: encryptSecretValue(payload.refreshToken),
    expiresAt,
    scope: payload.scope || microsoftScopes.join(" "),
    updatedAt: nowIso,
    createdAt: nowIso,
  };
  await firestoreAuthedRequest(appUserToken, getMicrosoftConnectionDocumentPath(userId), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: encodeFirestoreValue(fields).mapValue.fields }),
  });
}

async function getMicrosoftConnectionRecord(userId: string, appUserToken: string) {
  try {
    const response = await firestoreAuthedRequest(appUserToken, getMicrosoftConnectionDocumentPath(userId), {
      method: "GET",
    });
    const payload = await response.json();
    return decodeFirestoreDocumentFields(payload?.fields) as MicrosoftConnectionRecord;
  } catch (error: any) {
    if (error?.status === 404) return null;
    throw error;
  }
}

async function getValidMicrosoftAccessToken(userId: string, appUserToken: string) {
  const record = await getMicrosoftConnectionRecord(userId, appUserToken);
  if (!record) return null;

  const expiresAt = new Date(record.expiresAt).getTime();
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000) {
    return {
      accessToken: decryptSecretValue(record.accessTokenEncrypted),
      record,
    };
  }

  const refreshed = await refreshMicrosoftTokens(decryptSecretValue(record.refreshTokenEncrypted));
  const nextRefreshToken = refreshed.refresh_token || decryptSecretValue(record.refreshTokenEncrypted);
  await saveMicrosoftConnection(userId, appUserToken, {
    microsoftUserId: record.microsoftUserId,
    microsoftEmail: record.microsoftEmail,
    accessToken: refreshed.access_token,
    refreshToken: nextRefreshToken,
    expiresIn: refreshed.expires_in,
    scope: refreshed.scope || record.scope,
  });

  return {
    accessToken: refreshed.access_token,
    record: {
      ...record,
      refreshTokenEncrypted: encryptSecretValue(nextRefreshToken),
      accessTokenEncrypted: encryptSecretValue(refreshed.access_token),
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      scope: refreshed.scope || record.scope,
    },
  };
}

function sanitizeWorkbookUserId(userId: string) {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function buildWorkbookFileName(userId: string, workbookType: string) {
  const safeUserId = sanitizeWorkbookUserId(userId);
  const normalizedType = workbookType === "main" ? "workbook" : `workbook-${sanitizeWorkbookUserId(workbookType)}`;
  return `${normalizedType}-user-${safeUserId}.docx`;
}

async function ensureMicrosoftWorkbookForUser(userId: string, appUserToken: string, workbookType: string) {
  const tokenBundle = await getValidMicrosoftAccessToken(userId, appUserToken);
  if (!tokenBundle) {
    throw Object.assign(new Error("Microsoft account not connected."), {
      status: 409,
      requiresMicrosoftLogin: true,
    });
  }

  const accessToken = tokenBundle.accessToken;
  await ensureWorkbookFolder(accessToken);

  const fileName = buildWorkbookFileName(userId, workbookType || "main");
  let driveItem: any;
  try {
    driveItem = await getWorkbookDriveItem(accessToken, fileName);
  } catch (error: any) {
    if (error?.status !== 404) throw error;
    const buffer = await createDefaultWorkbookBuffer(userId);
    driveItem = await uploadWorkbook(accessToken, fileName, buffer);
  }

  return {
    driveItem,
    fileName,
  };
}

async function createDefaultWorkbookBuffer(userId: string) {
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun("Education Revolution Workbook")],
          }),
          new Paragraph({
            children: [new TextRun(`Student workbook for ${userId}`)],
          }),
          new Paragraph({
            children: [new TextRun("Start writing here.")],
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}

async function ensureWorkbookFolder(accessToken: string) {
  const encodedFolder = encodeURIComponent("Education Revolution Workbooks");
  try {
    await graphRequest(accessToken, `/me/drive/root:/${encodedFolder}`);
    return;
  } catch (error: any) {
    if (error?.status !== 404) throw error;
  }

  await graphRequest(accessToken, "/me/drive/root/children", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Education Revolution Workbooks",
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    }),
  });
}

async function getWorkbookDriveItem(accessToken: string, fileName: string) {
  const encodedFolder = encodeURIComponent("Education Revolution Workbooks");
  const response = await graphRequest(
    accessToken,
    `/me/drive/root:/${encodedFolder}/${encodeURIComponent(fileName)}`,
  );
  return response.json();
}

async function uploadWorkbook(accessToken: string, fileName: string, buffer: Buffer) {
  const encodedFolder = encodeURIComponent("Education Revolution Workbooks");
  const response = await graphRequest(
    accessToken,
    `/me/drive/root:/${encodedFolder}/${encodeURIComponent(fileName)}:/content`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      body: buffer,
    },
  );
  return response.json();
}

function signJaasJwt(payload: Record<string, unknown>) {
  const appId = process.env.UNI_JITSI_APP_ID?.trim() || process.env.VITE_UNI_JITSI_APP_ID?.trim();
  const kid = process.env.UNI_JITSI_KID?.trim();
  const rawPrivateKey = process.env.UNI_JITSI_PRIVATE_KEY?.trim();

  if (!appId || !kid || !rawPrivateKey) {
    throw new Error("University Jitsi is missing APP_ID, KID, or PRIVATE_KEY.");
  }

  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: `${appId}/${kid}`,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(normalizePrivateKey(rawPrivateKey));
  const token = `${signingInput}.${base64UrlEncode(signature)}`;

  return { token, appId };
}

async function extractDocxText(buffer: Buffer) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "edurev-docx-"));
  const inputPath = path.join(tempDir, "upload.docx");

  try {
    fs.writeFileSync(inputPath, buffer);
    const { stdout } = await execFileAsync("unzip", ["-p", inputPath, "word/document.xml"], {
      maxBuffer: 12 * 1024 * 1024,
      encoding: "utf8",
    });

    const text = extractReadableTextFromOfficeXml(stdout || "");
    if (!text) {
      throw new Error("The DOCX file did not contain readable text.");
    }

    return text;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function extractPptxText(buffer: Buffer) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "edurev-pptx-"));
  const inputPath = path.join(tempDir, "upload.pptx");

  try {
    fs.writeFileSync(inputPath, buffer);
    const { stdout } = await execFileAsync("unzip", ["-Z1", inputPath], {
      maxBuffer: 12 * 1024 * 1024,
      encoding: "utf8",
    });

    const slideEntries = (stdout || "")
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry))
      .sort((a, b) => {
        const aMatch = a.match(/slide(\d+)\.xml$/i);
        const bMatch = b.match(/slide(\d+)\.xml$/i);
        return Number(aMatch?.[1] || 0) - Number(bMatch?.[1] || 0);
      });

    if (!slideEntries.length) {
      throw new Error("The PPTX file did not contain readable slide content.");
    }

    const slideTexts = await Promise.all(
      slideEntries.map(async (entry) => {
        const { stdout: slideXml } = await execFileAsync("unzip", ["-p", inputPath, entry], {
          maxBuffer: 12 * 1024 * 1024,
          encoding: "utf8",
        });
        return extractReadableTextFromOfficeXml(slideXml || "");
      }),
    );

    const text = slideTexts.filter(Boolean).join("\n\n").trim();
    if (!text) {
      throw new Error("The PPTX file did not contain readable slide text.");
    }

    return text;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

app.post("/api/document-text", async (req, res) => {
  const { dataUrl = "", fileName = "", mimeType = "" } = req.body || {};
  const normalizedMime = typeof mimeType === "string" ? mimeType.trim().toLowerCase() : "";
  const normalizedName = typeof fileName === "string" ? fileName.trim().toLowerCase() : "";

  const match =
    typeof dataUrl === "string"
      ? dataUrl.match(/^data:(.+);base64,(.+)$/)
      : null;

  if (!match) {
    res.status(400).json({ error: "Invalid uploaded document payload." });
    return;
  }

  const effectiveMime = normalizedMime || match[1].toLowerCase();
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, "base64");
  const isDocx =
    effectiveMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    normalizedName.endsWith(".docx");
  const isPptx =
    effectiveMime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    normalizedName.endsWith(".pptx");

  if (!isDocx && !isPptx) {
    res.status(400).json({
      error: "Only DOCX and PPTX extraction are supported by this endpoint.",
    });
    return;
  }

  try {
    const text = isDocx ? await extractDocxText(buffer) : await extractPptxText(buffer);
    res.json({ text });
  } catch (error: any) {
    res.status(500).json({
      error: typeof error?.message === "string" ? error.message : `Could not extract the ${isDocx ? "DOCX" : "PPTX"} text.`,
    });
  }
});

app.get("/api/google-search-status", (_req, res) => {
  const hasApiKey = Boolean(process.env.GOOGLE_SEARCH_API_KEY?.trim());
  const hasSearchEngineId = Boolean(process.env.GOOGLE_SEARCH_ENGINE_ID?.trim());

  res.json({
    hasApiKey,
    hasSearchEngineId,
    isConfigured: hasApiKey && hasSearchEngineId,
  });
});

app.post("/api/google-search", async (req, res) => {
  const { q = "", key, cx } = req.body || {};
  const query = typeof q === "string" ? q.trim() : "";
  const apiKey =
    process.env.GOOGLE_SEARCH_API_KEY ||
    (typeof key === "string" ? key.trim() : "");
  const searchEngineId =
    process.env.GOOGLE_SEARCH_ENGINE_ID ||
    (typeof cx === "string" ? cx.trim() : "");

  if (!query) {
    res.status(400).json({ error: "Search query is required." });
    return;
  }

  if (!apiKey || !searchEngineId) {
    res.status(500).json({
      error: "Google Custom Search is not configured. Add GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID on the server, or provide them in the Resources setup card.",
    });
    return;
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      cx: searchEngineId,
      q: query,
      num: "8",
    });
    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({
        error: data?.error?.message || "Google search failed.",
      });
      return;
    }

    res.json({
      items: Array.isArray(data?.items) ? data.items : [],
    });
  } catch (error: any) {
    res.status(500).json({
      error: typeof error?.message === "string" ? error.message : "Google search failed.",
    });
  }
});

app.get("/api/school-search", async (req, res) => {
  const rawQuery = req.query.q;
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";

  if (query.length < 2) {
    res.json({ schools: [] });
    return;
  }

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      countrycodes: "au",
      addressdetails: "1",
      limit: "20",
      q: query,
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        "User-Agent": "EduRevAI/1.0 (school-search)",
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({
        error: data?.error || "School search failed.",
      });
      return;
    }

    const normalizedQuery = query.toLowerCase();
    const educationTypes = new Set(["school", "university", "college", "kindergarten"]);
    const schools = Array.isArray(data)
      ? data
          .filter((item: any) => {
            const category = String(item?.category || "").toLowerCase();
            const type = String(item?.type || "").toLowerCase();
            const displayName = String(item?.display_name || "").toLowerCase();
            return (
              (category === "amenity" && educationTypes.has(type)) ||
              displayName.includes("school") ||
              displayName.includes("university") ||
              displayName.includes("college")
            );
          })
          .map((item: any) => {
            const address = item?.address || {};
            const suburb =
              address.suburb ||
              address.neighbourhood ||
              address.town ||
              address.city_district ||
              address.city ||
              "";
            const state = address.state || "";
            const postcode = address.postcode || "";
            const name = item?.name || item?.display_name?.split(",")[0] || "School";
            const score =
              (name.toLowerCase().includes(normalizedQuery) ? 24 : 0) +
              (item?.display_name?.toLowerCase().includes(normalizedQuery) ? 12 : 0) +
              (suburb.toLowerCase().includes(normalizedQuery) ? 4 : 0) +
              (String(item?.type || "").toLowerCase() === "university" && normalizedQuery.includes("university") ? 8 : 0) +
              (String(item?.type || "").toLowerCase() === "school" && normalizedQuery.includes("school") ? 8 : 0);

            return {
              id: `${item.osm_type}-${item.osm_id}`,
              name,
              suburb,
              state,
              postcode,
              displayLabel: [name, suburb, state].filter(Boolean).join(" · "),
              score,
            };
          })
          .sort((a: any, b: any) => b.score - a.score || a.name.localeCompare(b.name))
      : [];

    const deduped = schools.filter(
      (school: any, index: number, list: any[]) =>
        list.findIndex(
          (candidate) =>
            candidate.name === school.name &&
            candidate.suburb === school.suburb &&
            candidate.state === school.state,
        ) === index,
    );

    res.json({ schools: deduped.slice(0, 8) });
  } catch (error: any) {
    res.status(500).json({
      error: typeof error?.message === "string" ? error.message : "School search failed.",
    });
  }
});

app.get("/api/library-search", async (req, res) => {
  const rawQuery = req.query.q;
  const rawMode = req.query.mode;
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
  const mode = rawMode === "qcaa" || rawMode === "australia" ? rawMode : "all";

  if (!query) {
    res.status(400).json({ error: "Search query is required." });
    return;
  }

  try {
    const normalizedQuery = query.toLowerCase();
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const modeBoostTerms =
      mode === "qcaa"
        ? ["queensland", "qcaa", "australia", "australian curriculum", "syllabus", "senior syllabus"]
        : mode === "australia"
          ? ["australia", "australian", "queensland", "nsw", "victoria", "curriculum"]
          : [];
    const upstreamQuery =
      mode === "qcaa"
        ? `${query} Queensland QCAA syllabus`
        : mode === "australia"
          ? `${query} Australia curriculum`
          : query;
    const scoreMatch = (parts: Array<string | null | undefined>) => {
      const haystack = parts
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack) return 0;

      let score = 0;
      if (haystack.includes(normalizedQuery)) score += 12;
      for (const token of queryTokens) {
        if (haystack.includes(token)) score += 3;
      }
      for (const boostTerm of modeBoostTerms) {
        if (haystack.includes(boostTerm)) score += mode === "qcaa" ? 8 : 5;
      }
      return score;
    };

    const [booksResponse, articlesResponse] = await Promise.all([
      fetch(`https://openlibrary.org/search.json?${new URLSearchParams({ q: upstreamQuery, limit: "18" }).toString()}`),
      fetch(`https://api.openalex.org/works?${new URLSearchParams({
        search: upstreamQuery,
        filter: "is_oa:true,type:article",
        per_page: "14",
      }).toString()}`),
    ]);

    const booksData = await booksResponse.json();
    const articlesData = await articlesResponse.json();

    const books = Array.isArray(booksData?.docs)
      ? booksData.docs
          .map((book: any, index: number) => {
          const editionKey = Array.isArray(book.edition_key) ? book.edition_key[0] : null;
          const internetArchiveId = Array.isArray(book.ia) ? book.ia[0] : null;
          const coverId = typeof book.cover_i === "number" ? book.cover_i : null;
          const author = Array.isArray(book.author_name) ? book.author_name[0] : "Unknown author";
          const subject = Array.isArray(book.subject) ? book.subject[0] : "Book";
          const year = book.first_publish_year ? String(book.first_publish_year) : "";
          const title = book.title || "Untitled book";
          const titleScore = scoreMatch([title]);
          const authorScore = scoreMatch(Array.isArray(book.author_name) ? book.author_name : [author]);
          const subjectScore = scoreMatch(Array.isArray(book.subject) ? book.subject.slice(0, 8) : [subject]);
          const score = titleScore * 3 + subjectScore * 2 + authorScore;

          return {
            id: `book-${editionKey || internetArchiveId || book.key || index}`,
            title,
            creator: author,
            subject,
            year,
            source: "Open Library",
            description: [subject, year ? `First published ${year}` : null].filter(Boolean).join(" · "),
            coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
            primaryUrl: editionKey ? `https://openlibrary.org/books/${editionKey}` : `https://openlibrary.org${book.key || ""}`,
            readUrl: internetArchiveId ? `https://archive.org/details/${internetArchiveId}` : null,
            pdfUrl: null,
            accessLabel: internetArchiveId ? "Read / borrow" : "Open record",
            type: "book",
            score,
          };
        })
          .filter((book: any) => {
            if (book.score <= 0) return false;
            if (mode === "all") return true;
            return book.score >= (mode === "qcaa" ? 16 : 12);
          })
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 10)
          .map(({ score, ...book }: any) => book)
      : [];

    const articles = Array.isArray(articlesData?.results)
      ? articlesData.results
          .map((work: any, index: number) => {
          const authors = Array.isArray(work.authorships)
            ? work.authorships
                .map((authorship: any) => authorship?.author?.display_name)
                .filter(Boolean)
                .slice(0, 2)
                .join(", ")
            : "Unknown author";
          const primaryTopic = work.primary_topic?.display_name || "Article";
          const year = work.publication_year ? String(work.publication_year) : "";
          const bestLocation = work.best_oa_location || work.primary_location || null;
          const pdfUrl = bestLocation?.pdf_url || null;
          const landingUrl = bestLocation?.landing_page_url || work.id || null;
          const journal = work.primary_location?.source?.display_name || work.host_venue?.display_name || "Open access source";
          const title = work.display_name || "Untitled article";
          const score =
            scoreMatch([title]) * 3 +
            scoreMatch([primaryTopic]) * 2 +
            scoreMatch([authors, journal]);

          return {
            id: `article-${work.id || index}`,
            title,
            creator: authors,
            subject: primaryTopic,
            year,
            source: journal,
            description: [primaryTopic, year ? `Published ${year}` : null].filter(Boolean).join(" · "),
            coverUrl: null,
            primaryUrl: landingUrl,
            readUrl: pdfUrl || landingUrl,
            pdfUrl,
            accessLabel: pdfUrl ? "Open PDF" : "Open article",
            type: "article",
            score,
          };
        })
          .filter((article: any) => {
            if (article.score <= 0) return false;
            if (mode === "all") return true;
            return article.score >= (mode === "qcaa" ? 14 : 10);
          })
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 8)
          .map(({ score, ...article }: any) => article)
      : [];

    res.json({ books, articles, mode });
  } catch (error: any) {
    res.status(500).json({
      error: typeof error?.message === "string" ? error.message : "Library search failed.",
    });
  }
});

app.post("/api/gemini", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY is missing on the server." });
    return;
  }

  const { mode = "generateContent", model, contents, config, message, systemInstruction, history } = req.body || {};
  if (!model) {
    res.status(400).json({ error: "model is required" });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    if (mode === "chat") {
      const chat = ai.chats.create({
        model,
        history,
        config: {
          ...(config || {}),
          ...(systemInstruction ? { systemInstruction } : {}),
        },
      });
      const response = await chat.sendMessage({ message });
      res.json({
        text: response.text || "",
        candidates: response.candidates || [],
      });
      return;
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });
    res.json({
      text: response.text || "",
      candidates: response.candidates || [],
    });
  } catch (error: any) {
    const formatted = formatGeminiError(error);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

app.post("/api/jaas/token", async (req, res) => {
  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  const callerPayload = decodeJwtPayload(bearer);
  const { roomName = "", displayName = "", email = "", moderator = false } = req.body || {};

  const safeRoomName = typeof roomName === "string" ? roomName.trim() : "";
  const safeDisplayName =
    typeof displayName === "string" && displayName.trim()
      ? displayName.trim()
      : typeof callerPayload?.name === "string" && callerPayload.name.trim()
        ? callerPayload.name.trim()
        : "EduRev University Student";
  const safeEmail =
    typeof email === "string" && email.trim()
      ? email.trim()
      : typeof callerPayload?.email === "string"
        ? callerPayload.email
        : "";

  if (!safeRoomName) {
    res.status(400).json({ error: "roomName is required." });
    return;
  }

  try {
    const appId = process.env.UNI_JITSI_APP_ID?.trim() || process.env.VITE_UNI_JITSI_APP_ID?.trim();
    if (!appId) {
      throw new Error("University Jitsi APP_ID is missing.");
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      aud: "jitsi",
      iss: "chat",
      sub: appId,
      room: safeRoomName || "*",
      exp: now + 60 * 60 * 4,
      nbf: now - 10,
      context: {
        user: {
          id:
            typeof callerPayload?.user_id === "string"
              ? callerPayload.user_id
              : typeof callerPayload?.sub === "string"
                ? callerPayload.sub
                : safeEmail || safeDisplayName,
          name: safeDisplayName,
          email: safeEmail,
          moderator: moderator ? "true" : "false",
        },
        features: {
          livestreaming: false,
          recording: false,
          transcription: false,
          "outbound-call": false,
        },
      },
    };

    const { token } = signJaasJwt(payload);
    res.json({ token });
  } catch (error: any) {
    res.status(500).json({
      error: typeof error?.message === "string" ? error.message : "Unable to create a University Jitsi token.",
    });
  }
});

app.get("/auth/microsoft/login", async (req, res) => {
  try {
    const appToken = typeof req.query.appToken === "string" ? req.query.appToken.trim() : "";
    if (!appToken) {
      res.status(401).send("You must be signed in to connect Microsoft.");
      return;
    }

    const user = await verifyFirebaseUserToken(appToken);
    const returnTo = normalizeReturnTo(typeof req.query.returnTo === "string" ? req.query.returnTo : undefined);
    const launchWord = String(req.query.launchWord || "").trim() === "1";
    const workbookType = typeof req.query.workbookType === "string" && req.query.workbookType.trim()
      ? req.query.workbookType.trim()
      : "main";
    const state = signMicrosoftState({
      uid: user.uid,
      appToken,
      returnTo,
      launchWord,
      workbookType,
      exp: Date.now() + 10 * 60 * 1000,
    });

    const authorizeUrl = new URL(getMicrosoftAuthorizeEndpoint());
    authorizeUrl.searchParams.set("client_id", requireMicrosoftEnv("MICROSOFT_CLIENT_ID"));
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", getMicrosoftRedirectUri());
    authorizeUrl.searchParams.set("response_mode", "query");
    authorizeUrl.searchParams.set("scope", microsoftScopes.join(" "));
    authorizeUrl.searchParams.set("state", state);

    res.redirect(authorizeUrl.toString());
  } catch (error: any) {
    res.status(500).send(typeof error?.message === "string" ? error.message : "Microsoft login could not start.");
  }
});

app.get("/auth", async (req, res, next) => {
  if (!req.query.code) {
    next();
    return;
  }

  let statePayloadForError: {
    uid: string;
    returnTo: string;
    exp: number;
    appToken: string;
    launchWord?: boolean;
    workbookType?: string;
  } | null = null;
  try {
    const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
    const state = typeof req.query.state === "string" ? req.query.state.trim() : "";
    if (!code || !state) {
      res.status(400).send("Missing Microsoft OAuth code or state.");
      return;
    }

    const statePayload = verifyMicrosoftState(state);
    statePayloadForError = statePayload;
    const tokenPayload = await exchangeMicrosoftCode(code);
    const profileResponse = await graphRequest(tokenPayload.access_token, "/me");
    const microsoftProfile = await profileResponse.json() as { id: string; mail?: string; userPrincipalName?: string };

    await verifyFirebaseUserToken(statePayload.appToken);
    await saveMicrosoftConnection(statePayload.uid, statePayload.appToken, {
      microsoftUserId: microsoftProfile.id,
      microsoftEmail: microsoftProfile.mail || microsoftProfile.userPrincipalName || "",
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token,
      expiresIn: tokenPayload.expires_in,
      scope: tokenPayload.scope,
    });

    if (statePayload.launchWord) {
      const { driveItem } = await ensureMicrosoftWorkbookForUser(
        statePayload.uid,
        statePayload.appToken,
        statePayload.workbookType || "main",
      );
      res.redirect(String(driveItem.webUrl || ""));
      return;
    }

    const origin = getRequestOrigin(req);
    const redirectUrl = new URL(statePayload.returnTo || "/workbooks/microsoft-word", origin || getMicrosoftRedirectUri());
    redirectUrl.searchParams.set("microsoft", "connected");
    res.redirect(redirectUrl.toString());
  } catch (error: any) {
    console.error("Microsoft OAuth callback failed:", error);
    const fallbackUrl = new URL(
      statePayloadForError?.returnTo || "/workbooks/microsoft-word",
      statePayloadForError?.returnTo || getRequestOrigin(req) || getMicrosoftRedirectUri(),
    );
    const message = typeof error?.message === "string" ? error.message : "";
    if (/Tenant does not have a SPO license/i.test(message)) {
      fallbackUrl.searchParams.set("microsoftError", "spo_license");
    } else {
      fallbackUrl.searchParams.set("microsoftError", "1");
    }
    res.redirect(fallbackUrl.toString());
  }
});

app.get("/api/microsoft/status", async (req, res) => {
  try {
    const user = await requireAuthenticatedAppUser(req);
    const record = await getMicrosoftConnectionRecord(user.uid, user.idToken);
    res.json({
      connected: Boolean(record),
      microsoftEmail: record?.microsoftEmail || "",
      expiresAt: record?.expiresAt || null,
    });
  } catch (error: any) {
    res.status(error?.status || 500).json({
      error: typeof error?.message === "string" ? error.message : "Could not check Microsoft status.",
    });
  }
});

app.post("/api/workbooks/open", async (req, res) => {
  try {
    const user = await requireAuthenticatedAppUser(req);
    const bodyUserId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    const workbookType = typeof req.body?.workbookType === "string" ? req.body.workbookType.trim() : "main";

    if (!bodyUserId || bodyUserId !== user.uid) {
      res.status(403).json({ error: "You can only open your own workbook." });
      return;
    }

    const { driveItem, fileName } = await ensureMicrosoftWorkbookForUser(
      user.uid,
      user.idToken,
      workbookType || "main",
    );

    res.json({
      webUrl: driveItem.webUrl,
      driveItemId: driveItem.id,
      fileName,
    });
  } catch (error: any) {
    console.error("Open workbook failed:", error);
    const message = typeof error?.message === "string" ? error.message : "Could not open the Microsoft workbook.";
    if (/Tenant does not have a SPO license/i.test(message)) {
      res.status(409).json({
        error: "This Microsoft account does not have OneDrive or SharePoint enabled for Word Online. Sign in with a Microsoft account that has OneDrive access, or use a licensed Microsoft 365 account.",
      });
      return;
    }
    res.status(error?.status || 500).json({
      error: message,
    });
  }
});

function sendIndex(res: express.Response) {
  res.setHeader("Cache-Control", "no-store");
  const indexPath = path.join(distPath, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  res.type("html").send(html);
}

app.get("/support", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EducationRev Support</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #f8fbff; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px; background: linear-gradient(180deg, #f8fbff 0%, #eef5fb 100%); }
    main { width: min(760px, 100%); border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 18px; background: rgba(255, 255, 255, 0.94); box-shadow: 0 24px 80px rgba(15, 23, 42, 0.10); padding: clamp(28px, 5vw, 48px); }
    h1 { margin: 0; font-size: clamp(2rem, 5vw, 3.25rem); line-height: 1; letter-spacing: 0; }
    h2 { margin: 30px 0 10px; font-size: 1.1rem; }
    p, li { color: #4b5563; font-size: 1rem; line-height: 1.65; font-weight: 600; }
    a { color: #4f46e5; font-weight: 800; }
    .card { margin-top: 22px; border-radius: 14px; background: #f9fafb; border: 1px solid #e5e7eb; padding: 18px; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
    .button { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; border-radius: 12px; background: #4f46e5; color: white; padding: 0 16px; text-decoration: none; }
  </style>
</head>
<body>
  <main>
    <h1>EducationRev Support</h1>
    <p>EducationRev is an education workspace for high school and university students. This page provides support information for users who need help with account access, sign-in, app behaviour, or data questions.</p>

    <section class="card">
      <h2>Contact support</h2>
      <p>Email: <a href="mailto:nemeanpartnersptyltd@gmail.com?subject=EducationRev%20Support">nemeanpartnersptyltd@gmail.com</a></p>
      <p>Include your device type, macOS version, the sign-in method you used, and a short description of the issue.</p>
      <div class="actions">
        <a class="button" href="mailto:nemeanpartnersptyltd@gmail.com?subject=EducationRev%20Support">Email Support</a>
        <a href="/auth">Return to EducationRev</a>
      </div>
    </section>

    <section>
      <h2>Common support topics</h2>
      <ul>
        <li>Google, Microsoft, email, or guest sign-in support.</li>
        <li>High school and university portal access.</li>
        <li>Questions about assignments, notes, planning, study tools, and saved workspace data.</li>
        <li>Requests about account deletion or privacy.</li>
      </ul>
    </section>

    <section>
      <h2>Policies</h2>
      <p><a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Service</a></p>
    </section>
  </main>
</body>
</html>`);
});

// Root route
app.get("/", (_req, res) => {
  sendIndex(res);
});

// Catch all routes
app.get("*", (_req, res) => {
  sendIndex(res);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
