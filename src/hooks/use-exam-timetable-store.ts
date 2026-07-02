import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Exam {
  id: string;
  subject: string;
  date: string;
  time: string;
  location?: string;
  duration?: string;
  notes?: string;
}

interface ExamTimetableState {
  exams: Exam[];
  addExam: (exam: Omit<Exam, 'id'>) => void;
  updateExam: (id: string, exam: Partial<Exam>) => void;
  deleteExam: (id: string) => void;
}

export const useExamTimetableStore = create<ExamTimetableState>()(
  persist(
    (set) => ({
      exams: [],
      addExam: (exam) =>
        set((state) => ({
          exams: [...state.exams, { ...exam, id: crypto.randomUUID() }],
        })),
      updateExam: (id, updatedExam) =>
        set((state) => ({
          exams: state.exams.map((exam) =>
            exam.id === id ? { ...exam, ...updatedExam } : exam
          ),
        })),
      deleteExam: (id) =>
        set((state) => ({
          exams: state.exams.filter((exam) => exam.id !== id),
        })),
    }),
    {
      name: 'exam-timetable-storage',
    }
  )
);
