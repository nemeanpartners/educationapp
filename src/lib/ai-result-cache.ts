import { doc, getDoc, serverTimestamp, setDoc } from '@/lib/portal-firestore';
import { auth, db } from '../firebase';

const LOCAL_AI_CACHE_KEY = 'edurev-ai-result-cache';
const CACHE_VERSION = 1;

type CachePayload = {
  scope: string;
  version?: number;
  input: unknown;
};

type LocalCacheEntry<T> = {
  result: T;
  updatedAt: string;
};

type FirestoreCacheDoc<T> = {
  userId: string;
  scope: string;
  version: number;
  cacheKey: string;
  result: T;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, normalizeValue(item)]),
    );
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeValue(value));
}

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function readLocalCacheStore() {
  if (typeof window === 'undefined') return {} as Record<string, LocalCacheEntry<unknown>>;
  try {
    const raw = window.localStorage.getItem(LOCAL_AI_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalCacheEntry<unknown>>) : {};
  } catch {
    return {};
  }
}

function writeLocalCacheStore(store: Record<string, LocalCacheEntry<unknown>>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_AI_CACHE_KEY, JSON.stringify(store));
  } catch {
    // Ignore local cache write failures.
  }
}

async function buildCacheKey(payload: CachePayload) {
  return sha256Hex(
    stableStringify({
      scope: payload.scope,
      version: payload.version || CACHE_VERSION,
      input: payload.input,
    }),
  );
}

export async function getCachedAiResult<T>(payload: CachePayload): Promise<T | null> {
  const cacheKey = await buildCacheKey(payload);
  const userId = auth.currentUser?.uid;
  const localStore = readLocalCacheStore();
  const localEntry = localStore[cacheKey] as LocalCacheEntry<T> | undefined;

  if (localEntry?.result !== undefined) {
    return localEntry.result;
  }

  if (!userId) {
    return null;
  }

  try {
    const snap = await getDoc(doc(db, 'aiCaches', `${userId}_${cacheKey}`));
    if (!snap.exists()) return null;
    const data = snap.data() as FirestoreCacheDoc<T>;
    if (data?.result === undefined) return null;

    localStore[cacheKey] = {
      result: data.result,
      updatedAt: new Date().toISOString(),
    };
    writeLocalCacheStore(localStore);
    return data.result;
  } catch {
    return null;
  }
}

export async function setCachedAiResult<T>(payload: CachePayload, result: T): Promise<T> {
  const cacheKey = await buildCacheKey(payload);
  const localStore = readLocalCacheStore();
  localStore[cacheKey] = {
    result,
    updatedAt: new Date().toISOString(),
  };
  writeLocalCacheStore(localStore);

  const userId = auth.currentUser?.uid;
  if (!userId) return result;

  try {
    await setDoc(
      doc(db, 'aiCaches', `${userId}_${cacheKey}`),
      {
        userId,
        scope: payload.scope,
        version: payload.version || CACHE_VERSION,
        cacheKey,
        result,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } satisfies FirestoreCacheDoc<T>,
      { merge: true },
    );
  } catch {
    // Firestore cache write is best-effort; local cache already holds the result.
  }

  return result;
}

export async function getOrCreateCachedAiResult<T>(
  payload: CachePayload,
  resolver: () => Promise<T>,
): Promise<T> {
  const cached = await getCachedAiResult<T>(payload);
  if (cached !== null) {
    return cached;
  }

  const result = await resolver();
  return setCachedAiResult(payload, result);
}
