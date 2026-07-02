import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AcademicGoal {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  subject?: string;
  category?: string;
  dueDate?: string;
  completedAt?: string;
}

interface AcademicGoalsState {
  goals: AcademicGoal[];
  addGoal: (goal: Omit<AcademicGoal, 'id'>) => void;
  updateGoal: (id: string, goal: Partial<AcademicGoal>) => void;
  deleteGoal: (id: string) => void;
}

export const useAcademicGoalsStore = create<AcademicGoalsState>()(
  persist(
    (set) => ({
      goals: [],
      addGoal: (goal) =>
        set((state) => ({
          goals: [...state.goals, { ...goal, id: crypto.randomUUID() }],
        })),
      updateGoal: (id, updatedGoal) =>
        set((state) => ({
          goals: state.goals.map((goal) =>
            goal.id === id ? { ...goal, ...updatedGoal } : goal
          ),
        })),
      deleteGoal: (id) =>
        set((state) => ({
          goals: state.goals.filter((goal) => goal.id !== id),
        })),
    }),
    {
      name: 'academic-goals-storage',
    }
  )
);
