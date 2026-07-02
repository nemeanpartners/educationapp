import type { PracticeQuizQuestion } from "../services/gemini";

export type SavedPracticeQuiz = {
  id: string;
  title: string;
  topic: string;
  subject: string;
  instructions: string;
  sourceText: string;
  questions: PracticeQuizQuestion[];
  createdAt: string;
};

const SAVED_PRACTICE_QUIZZES_KEY = "edurev-saved-practice-quizzes";

function readSavedPracticeQuizzes(): SavedPracticeQuiz[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_PRACTICE_QUIZZES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedPracticeQuizzes(items: SavedPracticeQuiz[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_PRACTICE_QUIZZES_KEY, JSON.stringify(items.slice(0, 50)));
}

export function savePracticeQuiz(input: Omit<SavedPracticeQuiz, "id" | "createdAt">) {
  const savedQuiz: SavedPracticeQuiz = {
    ...input,
    id: `practice-quiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const existing = readSavedPracticeQuizzes();
  writeSavedPracticeQuizzes([savedQuiz, ...existing]);
  return savedQuiz;
}

export function getSavedPracticeQuiz(id: string | null) {
  if (!id) return null;
  return readSavedPracticeQuizzes().find((item) => item.id === id) || null;
}
