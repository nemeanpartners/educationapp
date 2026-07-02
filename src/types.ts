export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'student' | 'admin';
  createdAt: string;
  accountType?: 'member' | 'guest';
  aiAccessEnabled?: boolean;
  username?: string;
  usernameLower?: string;
  microsoftEmail?: string;
  pronouns?: 'she/her' | 'he/him' | 'they/them' | 'prefer-not-to-say';
  gradeLevel?: string;
  schoolName?: string;
  institutionName?: string;
  universityStudyLevel?: string;
  degreeProgram?: string;
  secondDegreeProgram?: string;
  majors?: string[];
  minors?: string[];
  studentNumber?: string;
  backgrounds?: PageBackgrounds;
  beyondUniversityCareerDirection?: BeyondUniversityCareerDirection;
}

export interface BeyondUniversityOpportunityDoor {
  title: string;
  whyItFits: string;
  roles: string[];
  employers: string[];
  nextMoves: string[];
}

export interface BeyondUniversityDegreePlanStep {
  window: string;
  focus: string;
  actions: string[];
}

export interface BeyondUniversityCareerDirectionReport {
  overview: string;
  tailoredFor: string;
  degreeLens: string;
  confidenceNote: string;
  opportunityDoors: BeyondUniversityOpportunityDoor[];
  highValueExperiences: string[];
  strengthsToBuild: string[];
  searchTerms: string[];
  immediatePlan: BeyondUniversityDegreePlanStep[];
  warnings: string[];
}

export interface BeyondUniversityCareerDirection {
  degreeKey: string;
  generatedAt: string;
  report: BeyondUniversityCareerDirectionReport;
}

export type BackgroundPage = 'dashboard' | 'profile';

export type PageBackgroundMode = 'default' | 'color' | 'preset' | 'custom';
export type PageBackgroundOverlay = 'clear' | 'blur';

export interface PageBackgroundSetting {
  mode: PageBackgroundMode;
  color?: string;
  url?: string;
  presetId?: string;
  overlay?: PageBackgroundOverlay;
}

export type PageBackgrounds = Partial<Record<BackgroundPage, PageBackgroundSetting>>;

export interface FlashcardSet {
  id: string;
  userId: string;
  title: string;
  description: string;
  cards: { term: string; definition: string }[];
  createdAt: string;
}

export interface Quiz {
  id: string;
  userId: string;
  title: string;
  questions: {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
  }[];
  createdAt: string;
}

export interface Assignment {
  id: string;
  userId: string;
  title: string;
  content: string;
  classSubject?: string;
  pages?: string[];
  updatedAt: string;
  createdAt: string;
}

export interface Resource {
  id: string;
  userId: string;
  title: string;
  url: string;
  type: 'link' | 'file' | 'note';
  tags: string[];
  createdAt: string;
}

export interface PlannerEntry {
  id: string;
  title: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  day?: string;      // Monday, Tuesday, etc.
  date?: string;     // YYYY-MM-DD
  type: 'study' | 'homework' | 'break' | 'class' | 'other';
  color?: string;
}

export interface PlannerPlan {
  id: string;
  userId: string;
  title: string;
  type: 'day' | 'week' | 'term' | 'semester';
  entries: PlannerEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface StudyPlanningAssessment {
  id: string;
  title: string;
  type: 'assignment' | 'exam' | 'quiz' | 'reading' | 'project' | 'other';
  dueDate: string;
  weighting: number;
}

export interface StudyPlanningCourse {
  id: string;
  name: string;
  code?: string;
  recommendedStudyHours: number;
  assessments: StudyPlanningAssessment[];
}

export interface StudyPlanningGradeGoal {
  id: string;
  title: string;
  targetGrade: string;
  courseId?: string;
}

export interface StudyPlanningAvailabilityBlock {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
}

export interface StudyPlanningCommitment {
  id: string;
  title: string;
  day: string;
  startTime: string;
  endTime: string;
}

export interface StudyPlanningProfile {
  userId: string;
  courses: StudyPlanningCourse[];
  gradeGoals: StudyPlanningGradeGoal[];
  availability: StudyPlanningAvailabilityBlock[];
  commitments: StudyPlanningCommitment[];
  createdAt: string;
  updatedAt: string;
}

export interface TodoTask {
  id: string;
  userId: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface AssignmentPlan {
  id: string;
  userId: string;
  deadlineId?: string;
  title: string;
  subject: string;
  assignmentType: string;
  dueDate: string;
  yearLevel?: string;
  currentStep: number; // 1-5
  steps: {
    id: number;
    title: string;
    milestoneDeadline?: string;
    tasks: { 
      id: string; 
      text: string; 
      completed: boolean;
      priority?: 'low' | 'medium' | 'high';
      estimatedTime?: string;
      dueDate?: string;
      url?: string;
      notes?: string;
      subtasks?: { id: string; text: string; completed: boolean }[];
    }[];
    completed: boolean;
  }[];
  researchResources?: {
    id: string;
    title: string;
    url: string;
    takeaways: string[];
    section: 'Intro' | 'Body' | 'Conclusion' | 'Other';
  }[];
  researchKeyPoints?: string[];
  createdAt: string;
  updatedAt: string;
  draftContent?: string;
  draftIntro?: string;
  draftBody?: string;
  draftConclusion?: string;
  referenceStyle?: 'IEEE' | 'Harvard';
  generatedReferences?: string;
  taskSheetText?: string;
  taskSheetFileName?: string;
  rubricText?: string;
  rubricFileName?: string;
  coachOverview?: string;
  extractedTask?: {
    extractedTitle?: string;
    subject?: string;
    assignmentType?: string;
    dueDate?: string;
    deliverables: string[];
    wordCount?: string;
    keyInstructions: string[];
    researchAreas: string[];
    topicsNeeded?: string[];
    formattingRequirements: string[];
    submissionRequirements: string[];
    successChecklist?: string[];
    outlineOverview?: string;
    summary: string;
  };
  schedulePreferences?: {
    preferredDays: string[];
    preferredTimeLabel: string;
    sessionsPerWeek: number;
  };
  coachSchedule?: {
    id: string;
    day: string;
    scheduledDate?: string;
    timeLabel: string;
    focusStep: number;
    focus: string;
    objective: string;
    isFocusDay?: boolean;
    completed: boolean;
  }[];
  rubricFeedback?: {
    estimatedMarkRange: string;
    overallVerdict: string;
    strengths: string[];
    weaknesses: string[];
    missingRequirements: string[];
    suggestedImprovements: string[];
    nextActions: string[];
    criteria: {
      criterion: string;
      estimatedBand: string;
      feedback: string;
      strengths: string[];
      fixes: string[];
    }[];
    updatedAt?: string;
  };
}

export interface MockExam {
  id: string;
  date: string;
  score: number;
  total: number;
  duration: number; // minutes
  notes?: string;
}

export interface ExamPlan {
  id: string;
  userId: string;
  title: string;
  subject: string;
  yearLevel: '10' | '11' | '12';
  examDate: string;
  topics: {
    id: string;
    name: string;
    confidence: number;
    completed: boolean;
    source?: 'manual' | 'qcaa';
  }[];
  currentStep: number;
  steps: {
    id: number;
    title: string;
    tasks: { 
      id: string; 
      text: string; 
      completed: boolean;
      priority?: 'low' | 'medium' | 'high';
      estimatedTime?: string;
      dueDate?: string;
    }[];
    completed: boolean;
  }[];
  resources?: {
    id: string;
    title: string;
    url: string;
    type: 'read' | 'watch' | 'practice';
    notes?: string;
  }[];
  focusSessions?: {
    id: string;
    duration: number; // minutes
    date: string;
    topicId?: string;
  }[];
  studySchedule?: {
    id: string;
    day: string;
    title: string;
    objective: string;
    focusTopicIds: string[];
    focusTopicNames: string[];
    studyStyle: string;
    homeworkTechnique: string;
    textbookTask: string;
    estimatedMinutes: number;
    methods: {
      id: string;
      title: string;
      description: string;
      type: 'flashcards' | 'practice' | 'summary' | 'textbook' | 'homework' | 'quiz';
    }[];
    checklist: {
      id: string;
      text: string;
      completed: boolean;
    }[];
  }[];
  mockExams?: MockExam[];
  createdAt: string;
  updatedAt: string;
}

export interface Deadline {
  id: string;
  userId: string;
  title: string;
  course: string;
  dueDate: string;
  type: 'exam' | 'assignment' | 'quiz' | 'project' | 'other';
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  createdAt: string;
}

export interface QCAAQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  why_explanation: string;
}

export interface QCAAQuizData {
  level_1: QCAAQuestion[];
  level_2: QCAAQuestion[];
  level_3: QCAAQuestion[];
}

export interface QCAAQuiz {
  id: string;
  subject: string;
  unit: string;
  type: 'official' | 'teacher';
  teacherNotes?: string;
  teacherId?: string;
  data: QCAAQuizData;
  createdAt: string;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  text: string;
  color: string;
  folder?: string;
  classSubject?: string;
  tags?: string[];
  position: { x: number; y: number };
  createdAt: string;
  updatedAt: string;
}
