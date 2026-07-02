export type StudentPortalType = 'highschool' | 'university';

const PORTAL_STORAGE_KEY = 'edurev-student-portal';

export function getStoredStudentPortal(): StudentPortalType {
  if (typeof window === 'undefined') return 'highschool';
  const stored = window.localStorage.getItem(PORTAL_STORAGE_KEY);
  return stored === 'university' ? 'university' : 'highschool';
}

export function setStoredStudentPortal(portal: StudentPortalType) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PORTAL_STORAGE_KEY, portal);
}

export function detectStudentPortalFromPath(pathname: string): StudentPortalType {
  return pathname === '/uni' || pathname.startsWith('/uni/') ? 'university' : 'highschool';
}

export function stripStudentPortalPrefix(pathname: string) {
  if (pathname === '/uni') return '/';
  if (pathname.startsWith('/uni/')) return pathname.slice(4);
  return pathname || '/';
}

export function studentPortalHome(portal: StudentPortalType) {
  return portal === 'university' ? '/uni' : '/';
}

export function studentPortalPath(portal: StudentPortalType, path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (portal === 'highschool') {
    return normalizedPath === '/uni' ? '/' : normalizedPath;
  }

  if (normalizedPath === '/' || normalizedPath === '') {
    return '/uni';
  }

  if (normalizedPath === '/uni' || normalizedPath.startsWith('/uni/')) {
    return normalizedPath;
  }

  return `/uni${normalizedPath}`;
}

export function studentPortalAssignmentCoachPath(portal: StudentPortalType, planId?: string) {
  if (portal === 'university') {
    return planId ? `/uni/assignment-coach-uni/${planId}` : '/uni/assignment-coach-uni';
  }
  return planId ? `/assignment-coach/${planId}` : '/assignment-coach';
}

export function studentPortalAssignmentCoachRubricPath(portal: StudentPortalType, planId: string) {
  if (portal === 'university') {
    return `/uni/assignment-coach-uni/${planId}/rubric-marking`;
  }
  return `/assignment-coach/${planId}/rubric-marking`;
}

export function studentPortalAssignmentPortalPath(portal: StudentPortalType, planId?: string) {
  if (portal === 'university') {
    return planId ? `/uni/assignment-portal-uni/${planId}` : '/uni/assignment-portal-uni';
  }
  return planId ? `/assignment-portal/${planId}` : '/assignment-portal';
}

export function studentPortalStudyHubPath(portal: StudentPortalType) {
  return portal === 'university' ? '/uni/study-hub' : '/study-hub';
}

export function studentPortalExamPortalPath(portal: StudentPortalType) {
  return portal === 'university' ? '/uni/exam-portal-uni' : '/study-hub';
}

export type StudentPortalToolRoute =
  | 'study'
  | 'learning-profile'
  | 'assistant'
  | 'the-brain'
  | 'question-breakdown'
  | 'practice-quiz'
  | 'mind-maps'
  | 'math-solver'
  | 'formula-explainer'
  | 'class-notes'
  | 'workbooks'
  | 'todo'
  | 'academic-goals'
  | 'timer'
  | 'resources'
  | 'calculator'
  | 'library'
  | 'growth'
  | 'progress'
  | 'deadlines'
  | 'daily-planner'
  | 'homework-planner'
  | 'lecture-lift'
  | 'lecture-lift-page'
  | 'assignment-studio'
  | 'research-desk'
  | 'report-builder'
  | 'teamwork'
  | 'meeting-room';

export function studentPortalToolPath(portal: StudentPortalType, route: StudentPortalToolRoute) {
  if (portal === 'highschool') {
    switch (route) {
      case 'lecture-lift':
      return '/class-notes?tool=lecture-lift';
    case 'lecture-lift-page':
      return '/class-notes?tool=lecture-lift';
    case 'assignment-studio':
      return '/assignment-coach';
    case 'research-desk':
      return '/resources';
    case 'report-builder':
      return '/workbooks';
    case 'teamwork':
      return '/social';
    case 'meeting-room':
      return '/social';
    default:
      return `/${route}`;
    }
  }

  switch (route) {
    case 'study':
      return '/uni/study-uni';
    case 'learning-profile':
      return '/uni/learning-profile-uni';
    case 'assistant':
      return '/uni/assistant-uni';
    case 'the-brain':
      return '/uni/the-brain-uni';
    case 'question-breakdown':
      return '/uni/question-breakdown-uni';
    case 'practice-quiz':
      return '/uni/practice-quiz-uni';
    case 'mind-maps':
      return '/uni/mind-maps-uni';
    case 'math-solver':
      return '/uni/math-solver-uni';
    case 'formula-explainer':
      return '/uni/formula-explainer-uni';
    case 'class-notes':
      return '/uni/class-notes-uni';
    case 'workbooks':
      return '/uni/workbooks-uni';
    case 'todo':
      return '/uni/todo-uni';
    case 'academic-goals':
      return '/uni/academic-goals-uni';
    case 'timer':
      return '/uni/timer-uni';
    case 'resources':
      return '/uni/resources-uni';
    case 'calculator':
      return '/uni/calculator-uni';
    case 'library':
      return '/uni/library-uni';
    case 'growth':
      return '/uni/growth-uni';
    case 'progress':
      return '/uni/progress-uni';
    case 'deadlines':
      return '/uni/deadlines-uni';
    case 'daily-planner':
      return '/uni/daily-planner-uni';
    case 'homework-planner':
      return '/uni/homework-planner-uni';
    case 'lecture-lift':
      return '/uni/class-notes-uni?tool=lecture-lift';
    case 'lecture-lift-page':
      return '/uni/lecture-lift-uni';
    case 'assignment-studio':
      return '/uni/assignment-studio-uni';
    case 'research-desk':
      return '/uni/research-desk-uni';
    case 'report-builder':
      return '/uni/report-builder-uni';
    case 'teamwork':
      return '/uni/teamwork-uni';
    case 'meeting-room':
      return '/uni/meeting-room-uni';
  }
}
