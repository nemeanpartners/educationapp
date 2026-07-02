import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StudyGameState {
  points: number;
  level: number;
  petName: string;
  petType: string;
  petMood: 'happy' | 'neutral' | 'sad';
  addPoints: (amount: number) => void;
  updatePet: (updates: Partial<{ petName: string; petType: string; petMood: 'happy' | 'neutral' | 'sad' }>) => void;
}

export const useStudyGameStore = create<StudyGameState>()(
  persist(
    (set) => ({
      points: 0,
      level: 1,
      petName: 'Study Buddy',
      petType: 'cat',
      petMood: 'happy',
      addPoints: (amount) =>
        set((state) => {
          const newPoints = state.points + amount;
          const newLevel = Math.floor(newPoints / 100) + 1;
          return { points: newPoints, level: newLevel };
        }),
      updatePet: (updates) =>
        set((state) => ({
          ...state,
          ...updates,
        })),
    }),
    {
      name: 'study-game-storage',
    }
  )
);
