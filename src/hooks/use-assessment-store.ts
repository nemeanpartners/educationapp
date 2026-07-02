import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Assessment {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  type: 'assignment' | 'exam' | 'quiz' | 'project';
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

interface AssessmentState {
  assessments: Assessment[];
  addAssessment: (assessment: Omit<Assessment, 'id'>) => void;
  updateAssessment: (id: string, assessment: Partial<Assessment>) => void;
  deleteAssessment: (id: string) => void;
}

export const useAssessmentStore = create<AssessmentState>()(
  persist(
    (set) => ({
      assessments: [],
      addAssessment: (assessment) =>
        set((state) => ({
          assessments: [...state.assessments, { ...assessment, id: crypto.randomUUID() }],
        })),
      updateAssessment: (id, updatedAssessment) =>
        set((state) => ({
          assessments: state.assessments.map((assessment) =>
            assessment.id === id ? { ...assessment, ...updatedAssessment } : assessment
          ),
        })),
      deleteAssessment: (id) =>
        set((state) => ({
          assessments: state.assessments.filter((assessment) => assessment.id !== id),
        })),
    }),
    {
      name: 'assessment-storage',
    }
  )
);
