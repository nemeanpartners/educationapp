import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TimetableEntry {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  room?: string;
  color?: string;
}

interface TimetableState {
  entries: TimetableEntry[];
  addEntry: (entry: Omit<TimetableEntry, 'id'>) => void;
  updateEntry: (id: string, entry: Partial<TimetableEntry>) => void;
  deleteEntry: (id: string) => void;
}

export const useTimetableStore = create<TimetableState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((state) => ({
          entries: [...state.entries, { ...entry, id: crypto.randomUUID() }],
        })),
      updateEntry: (id, updatedEntry) =>
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === id ? { ...entry, ...updatedEntry } : entry
          ),
        })),
      deleteEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((entry) => entry.id !== id),
        })),
    }),
    {
      name: 'timetable-storage',
    }
  )
);
