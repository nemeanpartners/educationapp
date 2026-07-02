import { doc, getDoc, serverTimestamp, setDoc } from '@/lib/portal-firestore';
import { auth, db } from '../firebase';
import type { MathSolverResponse } from '../services/gemini';

const GLOBAL_COLLECTION = 'mathSolverOutputs';
const USER_COLLECTION = 'userMathSolverOutputs';

type MathSolverCacheInput = {
  problem: string;
  mode: string;
  level: string;
};

type MathSolverCacheDoc = {
  cacheKey: string;
  normalizedLookup: string;
  problem: string;
  mode: string;
  level: string;
  result: MathSolverResponse;
  userId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function normalizeLookupValue(input: MathSolverCacheInput) {
  return [
    input.problem
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[–—]/g, '-')
      .trim(),
    input.mode.toLowerCase().trim(),
    input.level.toLowerCase().trim(),
  ].join('::');
}

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function buildCacheKey(input: MathSolverCacheInput) {
  return sha256Hex(normalizeLookupValue(input));
}

export async function getCachedMathSolverResult(input: MathSolverCacheInput): Promise<MathSolverResponse | null> {
  const cacheKey = await buildCacheKey(input);
  const globalRef = doc(db, GLOBAL_COLLECTION, cacheKey);

  try {
    const globalSnap = await getDoc(globalRef);
    if (globalSnap.exists()) {
      const data = globalSnap.data() as MathSolverCacheDoc;
      if (data?.result) return data.result;
    }
  } catch {
    // Ignore global cache read failures.
  }

  const userId = auth.currentUser?.uid;
  if (!userId) return null;

  try {
    const userSnap = await getDoc(doc(db, USER_COLLECTION, `${userId}_${cacheKey}`));
    if (!userSnap.exists()) return null;
    const data = userSnap.data() as MathSolverCacheDoc;
    return data?.result || null;
  } catch {
    return null;
  }
}

export async function saveMathSolverResult(
  input: MathSolverCacheInput,
  result: MathSolverResponse,
): Promise<void> {
  const cacheKey = await buildCacheKey(input);
  const normalizedLookup = normalizeLookupValue(input);
  const baseDoc = {
    cacheKey,
    normalizedLookup,
    problem: input.problem.trim(),
    mode: input.mode,
    level: input.level,
    result,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(
      doc(db, GLOBAL_COLLECTION, cacheKey),
      {
        ...baseDoc,
        createdAt: serverTimestamp(),
      } satisfies MathSolverCacheDoc,
      { merge: true },
    );
  } catch {
    // Ignore global cache write failures.
  }

  const userId = auth.currentUser?.uid;
  if (!userId) return;

  try {
    await setDoc(
      doc(db, USER_COLLECTION, `${userId}_${cacheKey}`),
      {
        ...baseDoc,
        userId,
        createdAt: serverTimestamp(),
      } satisfies MathSolverCacheDoc,
      { merge: true },
    );
  } catch {
    // Ignore user cache write failures.
  }
}
