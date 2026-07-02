import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ClassNote {
  id: string;
  title: string;
  subject: string;
  content: string;
  updatedAt: string;
}

interface ClassNotesState {
  notes: ClassNote[];
  addNote: (note: Omit<ClassNote, 'id'>) => void;
  updateNote: (id: string, note: Partial<ClassNote>) => void;
  deleteNote: (id: string) => void;
}

export const useClassNotesStore = create<ClassNotesState>()(
  persist(
    (set) => ({
      notes: [],
      addNote: (note) =>
        set((state) => ({
          notes: [...state.notes, { ...note, id: crypto.randomUUID() }],
        })),
      updateNote: (id, updatedNote) =>
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id ? { ...note, ...updatedNote, updatedAt: new Date().toISOString() } : note
          ),
        })),
      deleteNote: (id) =>
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
        })),
    }),
    {
      name: 'class-notes-storage',
    }
  )
);
