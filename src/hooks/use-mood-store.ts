import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MoodEntry {
  id: string;
  mood: 'happy' | 'neutral' | 'sad' | 'stressed' | 'tired';
  date: string;
  note?: string;
}

interface MoodState {
  entries: MoodEntry[];
  addEntry: (entry: Omit<MoodEntry, 'id'>) => void;
  deleteEntry: (id: string) => void;
}

export const useMoodStore = create<MoodState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((state) => ({
          entries: [...state.entries, { ...entry, id: crypto.randomUUID() }],
        })),
      deleteEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((entry) => entry.id !== id),
        })),
    }),
    {
      name: 'mood-storage',
    }
  )
);
