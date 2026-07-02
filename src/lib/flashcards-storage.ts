import { addDoc, collection } from "@/lib/portal-firestore";
import { db } from "../firebase";
import type { FlashcardSet } from "../types";

const LOCAL_FLASHCARDS_KEY = "edurev-local-flashcards";

type FlashcardInput = Omit<FlashcardSet, "id">;

function readLocalFlashcards(): FlashcardSet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_FLASHCARDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalFlashcards(items: FlashcardSet[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_FLASHCARDS_KEY, JSON.stringify(items));
}

export function getSavedFlashcards(userId?: string | null) {
  const localItems = readLocalFlashcards();
  if (!userId) return localItems;
  return localItems.filter((item) => item.userId === userId);
}

export function mergeFlashcardSets(remoteItems: FlashcardSet[], userId?: string | null) {
  const localItems = getSavedFlashcards(userId);
  const merged = new Map<string, FlashcardSet>();
  [...localItems, ...remoteItems].forEach((item) => {
    merged.set(item.id, item);
  });
  return [...merged.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function saveFlashcardSet(input: FlashcardInput) {
  const localSet: FlashcardSet = {
    ...input,
    id: `local-flashcards-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };

  const existing = readLocalFlashcards();
  writeLocalFlashcards([localSet, ...existing]);

  try {
    const ref = await addDoc(collection(db, "flashcards"), input);
    const syncedSet: FlashcardSet = { ...localSet, id: ref.id };
    const next = readLocalFlashcards().map((item) => (item.id === localSet.id ? syncedSet : item));
    writeLocalFlashcards(next);
    return { saved: syncedSet, persistedRemotely: true };
  } catch (error) {
    console.error("Flashcards saved locally because Firestore create failed:", error);
    return { saved: localSet, persistedRemotely: false };
  }
}
