import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  progress: number;
  maxProgress: number;
}

interface AchievementsState {
  achievements: Achievement[];
  unlockAchievement: (id: string) => void;
  updateProgress: (id: string, progress: number) => void;
}

export const useAchievementsStore = create<AchievementsState>()(
  persist(
    (set) => ({
      achievements: [
        { id: 'first-login', title: 'Welcome!', description: 'Log in for the first time', icon: '👋', progress: 1, maxProgress: 1, unlockedAt: new Date().toISOString() },
        { id: 'study-streak-3', title: 'Consistent', description: 'Study for 3 days in a row', icon: '🔥', progress: 0, maxProgress: 3 },
        { id: 'first-quiz', title: 'Quiz Whiz', description: 'Complete your first quiz', icon: '🧠', progress: 0, maxProgress: 1 },
      ],
      unlockAchievement: (id) =>
        set((state) => ({
          achievements: state.achievements.map((a) =>
            a.id === id ? { ...a, unlockedAt: new Date().toISOString(), progress: a.maxProgress } : a
          ),
        })),
      updateProgress: (id, progress) =>
        set((state) => ({
          achievements: state.achievements.map((a) =>
            a.id === id ? { ...a, progress: Math.min(progress, a.maxProgress), unlockedAt: progress >= a.maxProgress ? new Date().toISOString() : a.unlockedAt } : a
          ),
        })),
    }),
    {
      name: 'achievements-storage',
    }
  )
);
