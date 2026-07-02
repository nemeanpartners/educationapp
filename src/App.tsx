import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from '@/lib/portal-firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';
import Auth from './components/Auth';
import { DesktopBrowserAuthPage, DesktopCompleteAuthPage } from './components/DesktopBrowserAuthPage';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import StudyTools from './components/StudyTools';
import WorkbookPage from './components/WorkbookPage';
import MicrosoftWordWorkbookPage from './components/MicrosoftWordWorkbookPage';
import WordOnlinePage from './components/WordOnlinePage';
import ClassNotesPage from './components/ClassNotesPage';
import AIAssistant from './components/AIAssistant';
import ResourceHub from './components/ResourceHub';
import LibraryPage from './components/LibraryPage';
import ProgramsPage from './components/ProgramsPage';
import TimerPage from './components/TimerPage';
import FocusMediaLibraryPage from './components/FocusMediaLibraryPage';
import RewardsPage from './components/RewardsPage';
import GrowthPage from './components/GrowthPage';
import ProgressPage from './components/ProgressPage';
import ClassProgressPage from './components/ClassProgressPage';
import ForestWorldPage from './components/ForestWorldPage';
import AnnouncementsPage from './components/AnnouncementsPage';
import ProfilePage from './components/ProfilePage';
import TeacherPage from './components/TeacherPage';
import TeacherPortalAccess from './components/TeacherPortalAccess';
import SchoolHeadAccess from './components/SchoolHeadAccess';
import AppAdminAccess from './components/AppAdminAccess';
import MoodLogsPage from './components/MoodLogsPage';
import TimetablePage from './components/TimetablePage';
import CalendarYearPage from './components/CalendarYearPage';
import MyClasses from './components/MyClasses';
import ClassDetailPage from './components/ClassDetailPage';
import PlanDashboardPage from './components/PlanDashboardPage';
import PlannerPage from './components/PlannerPage';
import TodoListPage from './components/TodoListPage';
import DeadlinesPage from './components/DeadlinesPage';
import StudyHubPage from './components/StudyHubPage';
import PortalPage from './components/portals/PortalPage';
import AppAdminPortal from './components/portals/AppAdminPortal';
import SchoolHeadPortal from './components/portals/SchoolHeadPortal';
import QuizGamePage from './components/QuizGamePage';
import GamesPage, {
  AtlasAdventureGamePage,
  KnowledgeTreeGamePage,
  MathRacerGamePage,
  MemoryCardsGamePage,
  SpaceKnowledgeQuestGamePage,
  TriviaRunGamePage,
} from './components/GamesPage';
import AssignmentPortalPage from './components/AssignmentPortalPage';
import AssignmentCoachPage from './components/AssignmentCoachPage';
import RubricMarkingPage from './components/RubricMarkingPage';
import DailyPlannerPage from './components/DailyPlannerPage';
import AdminSettingsPage from './components/AdminSettingsPage';
import HomeworkPlannerPage from './components/HomeworkPlannerPage';
import HomeworkTimetablePage from './components/HomeworkTimetablePage';
import NotesPage from './components/NotesPage';
import TheBrainPage from './components/TheBrainPage';
import EmailPage from './components/EmailPage';
import AcademicGoalsPage from './components/AcademicGoalsPage';
import BeyondSchoolPage from './components/BeyondSchoolPage';
import MotivationWallPage from './components/MotivationWallPage';
import StemInitiativesPage from './components/StemInitiativesPage';
import SettingsPage from './components/SettingsPage';
import SocialPage from './components/SocialPage';
import AdvancedCalculatorPage from './components/AdvancedCalculatorPage';
import MathSolverPage from './components/MathSolverPage';
import FormulaExplainerPage from './components/FormulaExplainerPage';
import PracticeQuizPage from './components/PracticeQuizPage';
import QuestionBreakdownPage from './components/QuestionBreakdownPage';
import MindMapsPage from './components/MindMapsPage';
import LearningProfilePage from './components/LearningProfilePage';
import AccountSetupPage from './components/AccountSetupPage';
import UniversityLectureLiftPage from './components/UniversityLectureLiftPage';
import UniversityAssignmentStudioPage from './components/UniversityAssignmentStudioPage';
import ResearchDeskPage from './components/ResearchDeskPage';
import TeamworkPage from './components/TeamworkPage';
import UniversityReportBuilderPage from './components/UniversityReportBuilderPage';
import MeetingRoomPage from './components/MeetingRoomPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { detectStudentPortalFromPath, getStoredStudentPortal, setStoredStudentPortal, stripStudentPortalPrefix, studentPortalHome, studentPortalPath, type StudentPortalType } from './lib/portal';
import { getAppReviewSeedFlashcardSets, getAppReviewSeedQuizzes } from './lib/study-presets';

const APP_REVIEW_UID = 'QlCp2eu9eEdIGc5LH9mXRilzcGx2';
const APP_REVIEW_EMAIL = 'tryonapptestuser@gmail.com';

function profileCacheKey(portal: StudentPortalType) {
  return `edurev-user-profile-cache-${portal}`;
}

function getAppReviewProfileSeed(portal: StudentPortalType): Partial<UserProfile> {
  const baseSeed: Partial<UserProfile> = {
    email: APP_REVIEW_EMAIL,
    displayName: 'TryOn App Test User',
    role: 'student',
    accountType: 'member',
    aiAccessEnabled: true,
    username: 'tryonapptestuser',
    usernameLower: 'tryonapptestuser',
    pronouns: 'prefer-not-to-say',
    studentNumber: 'EDUREV-REVIEW-001',
    backgrounds: {
      dashboard: {
        mode: 'default',
      },
      profile: {
        mode: 'default',
      },
    },
  };

  if (portal === 'university') {
    return {
      ...baseSeed,
      institutionName: 'Queensland University of Technology',
      universityStudyLevel: 'Bachelor',
      degreeProgram: 'Business and Media',
      secondDegreeProgram: '',
      majors: ['Marketing', 'Digital Media'],
      minors: ['Communication'],
    };
  }

  return {
    ...baseSeed,
    gradeLevel: '11',
    schoolName: 'EduRev Demo College',
  };
}

function withAccountProfileFields(profile: UserProfile, firebaseUser: User): UserProfile {
  const isGuestAccount = firebaseUser.isAnonymous || profile.accountType === 'guest';
  const activePortal =
    typeof window !== 'undefined'
      ? resolveActivePortalFromLocation(window.location.pathname)
      : getStoredStudentPortal();
  const reviewSeed = firebaseUser.uid === APP_REVIEW_UID ? getAppReviewProfileSeed(activePortal) : null;

  return {
    ...profile,
    ...(reviewSeed || {}),
    displayName: profile.displayName || firebaseUser.displayName || reviewSeed?.displayName || (isGuestAccount ? 'Guest User' : 'Student'),
    photoURL: profile.photoURL || firebaseUser.photoURL || '',
    email: profile.email || firebaseUser.email || reviewSeed?.email || '',
    accountType: isGuestAccount ? 'guest' : (profile.accountType || 'member'),
    aiAccessEnabled: typeof profile.aiAccessEnabled === 'boolean' ? profile.aiAccessEnabled : !isGuestAccount,
    username: profile.username || reviewSeed?.username || '',
    usernameLower: profile.usernameLower || reviewSeed?.usernameLower || '',
    pronouns: profile.pronouns || reviewSeed?.pronouns || 'prefer-not-to-say',
    gradeLevel: profile.gradeLevel || reviewSeed?.gradeLevel || '',
    schoolName: profile.schoolName || reviewSeed?.schoolName || '',
    institutionName: profile.institutionName || reviewSeed?.institutionName || '',
    universityStudyLevel: profile.universityStudyLevel || reviewSeed?.universityStudyLevel || '',
    degreeProgram: profile.degreeProgram || reviewSeed?.degreeProgram || '',
    secondDegreeProgram: profile.secondDegreeProgram || reviewSeed?.secondDegreeProgram || '',
    majors: Array.isArray(profile.majors) ? profile.majors : (reviewSeed?.majors || []),
    minors: Array.isArray(profile.minors) ? profile.minors : (reviewSeed?.minors || []),
    studentNumber: profile.studentNumber || reviewSeed?.studentNumber || '',
    backgrounds: profile.backgrounds || reviewSeed?.backgrounds || {},
  };
}

function getAppReviewTimetableEntries(portal: StudentPortalType) {
  if (portal === 'university') {
    return [
      { id: 'review-uni-1', subject: 'Marketing Strategy', day: 'Monday', startTime: '09:00', endTime: '10:30', location: 'B112', teacher: 'Dr Lewis', color: '#dbeafe' },
      { id: 'review-uni-2', subject: 'Digital Media Studio', day: 'Tuesday', startTime: '11:00', endTime: '13:00', location: 'Studio 4', teacher: 'Prof Chen', color: '#ede9fe' },
      { id: 'review-uni-3', subject: 'Research Methods', day: 'Wednesday', startTime: '14:00', endTime: '15:30', location: 'Online', teacher: 'Dr Ahmed', color: '#d1fae5' },
      { id: 'review-uni-4', subject: 'Consumer Behaviour', day: 'Thursday', startTime: '10:00', endTime: '11:30', location: 'C201', teacher: 'Dr Patel', color: '#fef3c7' },
    ];
  }

  return [
    { id: 'review-hs-1', subject: 'English', day: 'Monday', startTime: '08:30', endTime: '09:30', location: 'Room 2', teacher: 'Ms Carter', color: '#dbeafe' },
    { id: 'review-hs-2', subject: 'Math Methods', day: 'Tuesday', startTime: '10:00', endTime: '11:00', location: 'Room 7', teacher: 'Mr Brown', color: '#ede9fe' },
    { id: 'review-hs-3', subject: 'Biology', day: 'Wednesday', startTime: '12:00', endTime: '13:00', location: 'Lab 1', teacher: 'Ms Green', color: '#d1fae5' },
    { id: 'review-hs-4', subject: 'History', day: 'Thursday', startTime: '09:00', endTime: '10:00', location: 'Room 5', teacher: 'Mr White', color: '#fef3c7' },
    { id: 'review-hs-5', subject: 'Digital Solutions', day: 'Friday', startTime: '13:30', endTime: '14:30', location: 'Tech Hub', teacher: 'Mrs Hall', color: '#ffe4e6' },
  ];
}

function getAppReviewHomeworkPlan(portal: StudentPortalType) {
  if (portal === 'university') {
    return [
      { subject: 'Marketing Strategy', technique: 'Pomodoro Technique', duration: '1.5 hours', timeOfDay: '16:00', day: 'Monday' },
      { subject: 'Digital Media Studio', technique: 'Active Recall', duration: '1 hour', timeOfDay: '18:00', day: 'Tuesday' },
      { subject: 'Research Methods', technique: 'Feynman Technique', duration: '1 hour', timeOfDay: '17:30', day: 'Wednesday' },
      { subject: 'Consumer Behaviour', technique: 'Spaced Repetition', duration: '45 minutes', timeOfDay: '15:30', day: 'Thursday' },
    ];
  }

  return [
    { subject: 'English', technique: 'Pomodoro Technique', duration: '1 hour', timeOfDay: '16:00', day: 'Monday' },
    { subject: 'Math Methods', technique: 'Active Recall', duration: '1 hour', timeOfDay: '17:30', day: 'Tuesday' },
    { subject: 'Biology', technique: 'Feynman Technique', duration: '45 minutes', timeOfDay: '18:00', day: 'Wednesday' },
    { subject: 'History', technique: 'Spaced Repetition', duration: '45 minutes', timeOfDay: '16:30', day: 'Thursday' },
  ];
}

function getAppReviewPlanningProfile(userId: string, portal: StudentPortalType) {
  const now = new Date().toISOString();
  if (portal === 'university') {
    return {
      userId,
      courses: [
        {
          id: 'review-course-1',
          name: 'Marketing Strategy',
          code: 'MKT201',
          recommendedStudyHours: 4,
          assessments: [
            { id: 'review-assessment-1', title: 'Case Analysis', type: 'assignment', dueDate: '2026-06-10', weighting: 30 },
          ],
        },
        {
          id: 'review-course-2',
          name: 'Research Methods',
          code: 'RES202',
          recommendedStudyHours: 3,
          assessments: [
            { id: 'review-assessment-2', title: 'Literature Review', type: 'project', dueDate: '2026-06-14', weighting: 35 },
          ],
        },
      ],
      gradeGoals: [
        { id: 'review-goal-1', title: 'Maintain distinction average', targetGrade: 'Distinction', courseId: 'review-course-1' },
      ],
      availability: [
        { id: 'review-availability-1', day: 'Monday', startTime: '15:00', endTime: '18:00' },
        { id: 'review-availability-2', day: 'Tuesday', startTime: '16:00', endTime: '19:00' },
        { id: 'review-availability-3', day: 'Thursday', startTime: '14:00', endTime: '18:00' },
      ],
      commitments: [
        { id: 'review-commitment-1', title: 'Part-time shift', day: 'Wednesday', startTime: '17:00', endTime: '20:00' },
      ],
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    userId,
    courses: [
      {
        id: 'review-course-1',
        name: 'English',
        code: 'ENG',
        recommendedStudyHours: 3,
        assessments: [
          { id: 'review-assessment-1', title: 'Comparative Essay', type: 'assignment', dueDate: '2026-06-09', weighting: 25 },
        ],
      },
      {
        id: 'review-course-2',
        name: 'Math Methods',
        code: 'MTH',
        recommendedStudyHours: 4,
        assessments: [
          { id: 'review-assessment-2', title: 'Unit Checkpoint Quiz', type: 'quiz', dueDate: '2026-06-11', weighting: 15 },
        ],
      },
      {
        id: 'review-course-3',
        name: 'Biology',
        code: 'BIO',
        recommendedStudyHours: 3,
        assessments: [
          { id: 'review-assessment-3', title: 'Lab Report Draft', type: 'project', dueDate: '2026-06-13', weighting: 20 },
        ],
      },
    ],
    gradeGoals: [
      { id: 'review-goal-1', title: 'Keep English above an A-', targetGrade: 'A-', courseId: 'review-course-1' },
    ],
    availability: [
      { id: 'review-availability-1', day: 'Monday', startTime: '15:30', endTime: '17:30' },
      { id: 'review-availability-2', day: 'Tuesday', startTime: '16:00', endTime: '18:00' },
      { id: 'review-availability-3', day: 'Thursday', startTime: '15:00', endTime: '17:00' },
    ],
    commitments: [
      { id: 'review-commitment-1', title: 'Netball training', day: 'Wednesday', startTime: '16:30', endTime: '18:00' },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function getAppReviewFormulaSeeds(userId: string) {
  const now = new Date().toISOString();
  return [
    {
      id: 'review-formula-1',
      userId,
      title: 'SUVAT: Final velocity',
      formula: 'v = u + at',
      subject: 'Physics',
      topic: 'Motion',
      explanation: {
        title: 'SUVAT final velocity formula',
        normalizedFormula: 'v = u + at',
        subject: 'Physics',
        topic: 'Motion',
        whatItIs: 'A motion equation that links final velocity, initial velocity, acceleration, and time.',
        variables: [
          { symbol: 'v', meaning: 'final velocity', units: 'm/s' },
          { symbol: 'u', meaning: 'initial velocity', units: 'm/s' },
          { symbol: 'a', meaning: 'acceleration', units: 'm/s²' },
          { symbol: 't', meaning: 'time', units: 's' },
        ],
        whyItIsUsed: 'Use it when acceleration is constant and you know three of the four values.',
        questionClues: ['constant acceleration', 'initial and final velocity', 'time interval'],
        howToUseIt: ['Write the known values with units.', 'Substitute into v = u + at.', 'Rearrange only if needed.', 'Check whether the sign of acceleration makes sense.'],
        workedExample: 'If a car starts at 4 m/s and accelerates at 3 m/s² for 5 s, then v = 4 + 3(5) = 19 m/s.',
        commonMistakes: ['Forgetting units', 'Using the wrong sign for acceleration', 'Using this when acceleration is not constant'],
      },
      createdAt: now,
    },
    {
      id: 'review-formula-2',
      userId,
      title: 'Linear gradient',
      formula: 'm = (y2 - y1) / (x2 - x1)',
      subject: 'Mathematics',
      topic: 'Algebra',
      explanation: {
        title: 'Gradient formula',
        normalizedFormula: 'm = (y2 - y1) / (x2 - x1)',
        subject: 'Mathematics',
        topic: 'Algebra',
        whatItIs: 'The gradient formula measures the slope of a straight line between two points.',
        variables: [
          { symbol: 'm', meaning: 'gradient or slope', units: 'unitless or context-based' },
          { symbol: 'x1, y1', meaning: 'coordinates of the first point', units: 'graph units' },
          { symbol: 'x2, y2', meaning: 'coordinates of the second point', units: 'graph units' },
        ],
        whyItIsUsed: 'Use it to find how steep a line is and whether it rises or falls.',
        questionClues: ['two coordinates', 'slope of the line', 'rate of change'],
        howToUseIt: ['Substitute the two points carefully.', 'Subtract in the same order on top and bottom.', 'Simplify the fraction if possible.'],
        workedExample: 'Between (2, 3) and (6, 11), m = (11 - 3)/(6 - 2) = 8/4 = 2.',
        commonMistakes: ['Mixing the order of coordinates', 'Subtracting x and y inconsistently', 'Dividing by zero when points have the same x-value'],
      },
      createdAt: now,
    },
  ];
}

function getAppReviewAssignmentPlans(userId: string, portal: StudentPortalType) {
  const now = new Date().toISOString();
  if (portal === 'university') {
    return [
      {
        id: 'review-assignment-plan-1',
        userId,
        title: 'Marketing case analysis',
        subject: 'Marketing Strategy',
        assignmentType: 'Case Study',
        dueDate: '2026-06-10',
        currentStep: 2,
        yearLevel: 'University',
        steps: [
          { id: 1, title: 'Understand Task', completed: true, tasks: [{ id: 'u1', text: 'Highlight the case question and marking criteria.', completed: true }] },
          { id: 2, title: 'Research', completed: false, tasks: [{ id: 'u2', text: 'Collect 3 sources on market positioning and competitor analysis.', completed: false }] },
          { id: 3, title: 'Planning', completed: false, tasks: [{ id: 'u3', text: 'Build the report outline and evidence map.', completed: false }] },
          { id: 4, title: 'Drafting', completed: false, tasks: [{ id: 'u4', text: 'Write the introduction and findings section.', completed: false }] },
          { id: 5, title: 'Review', completed: false, tasks: [{ id: 'u5', text: 'Check citations, formatting, and recommendations.', completed: false }] },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  return [
    {
      id: 'review-assignment-plan-1',
      userId,
      title: 'English comparative essay',
      subject: 'English',
      assignmentType: 'Essay',
      dueDate: '2026-06-09',
      currentStep: 2,
      yearLevel: '11',
      steps: [
        { id: 1, title: 'Understand Task', completed: true, tasks: [{ id: 'h1', text: 'Highlight the comparison question and key verbs.', completed: true }] },
        { id: 2, title: 'Research', completed: false, tasks: [{ id: 'h2', text: 'Collect 4 quotes that compare both texts clearly.', completed: false }] },
        { id: 3, title: 'Planning', completed: false, tasks: [{ id: 'h3', text: 'Build the intro, body paragraph, and evidence plan.', completed: false }] },
        { id: 4, title: 'Drafting', completed: false, tasks: [{ id: 'h4', text: 'Write the first draft using the paragraph plan.', completed: false }] },
        { id: 5, title: 'Review', completed: false, tasks: [{ id: 'h5', text: 'Improve expression and check the rubric.', completed: false }] },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

async function ensureAppReviewDemoData(userId: string, portal: StudentPortalType) {
  const now = new Date().toISOString();
  const timetableRef = doc(db, 'timetables', userId);
  const timetableSnap = await getDoc(timetableRef);
  if (!timetableSnap.exists() || !Array.isArray(timetableSnap.data()?.entries) || timetableSnap.data().entries.length === 0) {
    await setDoc(timetableRef, {
      userId,
      entries: getAppReviewTimetableEntries(portal),
      updatedAt: now,
    }, { merge: true });
  }

  const homeworkRef = doc(db, 'homeworkPlans', userId);
  const homeworkSnap = await getDoc(homeworkRef);
  if (!homeworkSnap.exists() || !Array.isArray(homeworkSnap.data()?.plan) || homeworkSnap.data().plan.length === 0) {
    await setDoc(homeworkRef, {
      userId,
      plan: getAppReviewHomeworkPlan(portal),
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }

  const planningRef = doc(db, 'studyPlanningProfiles', userId);
  const planningSnap = await getDoc(planningRef);
  if (!planningSnap.exists() || !Array.isArray(planningSnap.data()?.courses) || planningSnap.data().courses.length === 0) {
    await setDoc(planningRef, getAppReviewPlanningProfile(userId, portal), { merge: true });
  }

  const calendarRef = doc(db, 'calendarNotes', userId);
  const calendarSnap = await getDoc(calendarRef);
  const yearKey = String(new Date().getFullYear());
  const existingYearNotes = calendarSnap.data()?.years?.[yearKey];
  if (!calendarSnap.exists() || !existingYearNotes || Object.keys(existingYearNotes).length === 0) {
    await setDoc(calendarRef, {
      userId,
      years: {
        [yearKey]: {
          '5': { '4': 'English essay draft due soon. Use the homework planner block after school.' },
          '6': {
            '10': 'Math quiz this week. Revise algebra methods and practice non-calculator questions.',
            '14': 'Biology lab report checkpoints and teacher feedback meeting.',
          },
        },
      },
      updatedAt: now,
    }, { merge: true });
  }

  const todoChecks = await getDocs(query(collection(db, 'todos'), where('userId', '==', userId), limit(1)));
  if (todoChecks.empty) {
    const todos = [
      { id: 'review-todo-1', text: 'Finish the English essay intro paragraph', completed: false },
      { id: 'review-todo-2', text: 'Review algebra questions 1 to 10', completed: false },
      { id: 'review-todo-3', text: 'Bring Biology practical notes to class', completed: true },
    ];

    await Promise.all(
      todos.map((todo) =>
        setDoc(doc(collection(db, 'todos'), todo.id), {
          id: todo.id,
          userId,
          text: todo.text,
          completed: todo.completed,
          createdAt: now,
        }),
      ),
    );
  }

  const deadlineChecks = await getDocs(query(collection(db, 'deadlines'), where('userId', '==', userId), limit(1)));
  if (deadlineChecks.empty) {
    const deadlines = portal === 'university'
      ? [
          { id: 'review-deadline-1', title: 'Marketing case analysis', subject: 'Marketing Strategy', type: 'assignment', dueDate: '2026-06-10', priority: 'high' },
          { id: 'review-deadline-2', title: 'Research methods literature review', subject: 'Research Methods', type: 'assignment', dueDate: '2026-06-14', priority: 'medium' },
          { id: 'review-deadline-3', title: 'Consumer behaviour reading notes', subject: 'Consumer Behaviour', type: 'reading', dueDate: '2026-06-08', priority: 'low' },
        ]
      : [
          { id: 'review-deadline-1', title: 'English comparative essay', subject: 'English', type: 'assignment', dueDate: '2026-06-09', priority: 'high' },
          { id: 'review-deadline-2', title: 'Math checkpoint quiz', subject: 'Math Methods', type: 'quiz', dueDate: '2026-06-11', priority: 'medium' },
          { id: 'review-deadline-3', title: 'Biology lab report draft', subject: 'Biology', type: 'assignment', dueDate: '2026-06-13', priority: 'medium' },
        ];

    await Promise.all(
      deadlines.map((deadline) =>
        setDoc(doc(collection(db, 'deadlines'), deadline.id), {
          ...deadline,
          userId,
          completed: false,
          createdAt: now,
        }),
      ),
    );
  }

  const flashcardChecks = await getDocs(query(collection(db, 'flashcards'), where('userId', '==', userId), limit(1)));
  if (flashcardChecks.empty) {
    await Promise.all(
      getAppReviewSeedFlashcardSets(userId).map((set, index) =>
        setDoc(doc(collection(db, 'flashcards'), `review-flashcards-${index + 1}`), set),
      ),
    );
  }

  const quizChecks = await getDocs(query(collection(db, 'quizzes'), where('userId', '==', userId), limit(1)));
  if (quizChecks.empty) {
    await Promise.all(
      getAppReviewSeedQuizzes(userId).map((quiz, index) =>
        setDoc(doc(collection(db, 'quizzes'), `review-quiz-${index + 1}`), quiz),
      ),
    );
  }

  const formulaChecks = await getDocs(query(collection(db, 'formulaExplanations'), where('userId', '==', userId), limit(1)));
  if (formulaChecks.empty) {
    await Promise.all(
      getAppReviewFormulaSeeds(userId).map((item) =>
        setDoc(doc(collection(db, 'formulaExplanations'), item.id), item),
      ),
    );
  }

  const assignmentChecks = await getDocs(query(collection(db, 'assignmentPlans'), where('userId', '==', userId), limit(1)));
  if (assignmentChecks.empty) {
    await Promise.all(
      getAppReviewAssignmentPlans(userId, portal).map((plan) =>
        setDoc(doc(collection(db, 'assignmentPlans'), plan.id), plan),
      ),
    );
  }
}

async function ensureAppReviewDemoDataForBothPortals(userId: string, activePortal: StudentPortalType) {
  const previousPortal = getStoredStudentPortal();
  const portals: StudentPortalType[] = activePortal === 'university'
    ? ['university', 'highschool']
    : ['highschool', 'university'];

  try {
    for (const portal of portals) {
      setStoredStudentPortal(portal);
      await ensureAppReviewDemoData(userId, portal);
    }
  } finally {
    setStoredStudentPortal(previousPortal || activePortal);
  }
}

async function syncUniversityDirectory(profile: UserProfile) {
  await setDoc(doc(db, 'userDirectory', profile.uid), {
    uid: profile.uid,
    displayName: profile.displayName || 'Student',
    email: profile.email || '',
    emailLower: (profile.email || '').toLowerCase().trim(),
    photoURL: profile.photoURL || '',
    institutionName: profile.institutionName || '',
    universityStudyLevel: profile.universityStudyLevel || '',
    degreeProgram: profile.degreeProgram || '',
    secondDegreeProgram: profile.secondDegreeProgram || '',
    majors: Array.isArray(profile.majors) ? profile.majors : [],
    minors: Array.isArray(profile.minors) ? profile.minors : [],
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

async function syncUserDirectoryAcrossPortals(profile: UserProfile, activePortal: StudentPortalType) {
  const previousPortal = getStoredStudentPortal();
  try {
    setStoredStudentPortal('highschool');
    await syncUniversityDirectory(profile);
    setStoredStudentPortal('university');
    await syncUniversityDirectory(profile);
  } finally {
    setStoredStudentPortal(previousPortal || activePortal);
  }
}

function isPortalProfileComplete(profile: UserProfile | null, portal: StudentPortalType) {
  if (!profile) return false;
  if (profile.accountType === 'guest') return true;

  if (portal === 'university') {
    return Boolean(profile.institutionName?.trim() && profile.degreeProgram?.trim());
  }

  return Boolean(profile.schoolName?.trim() && profile.gradeLevel?.trim());
}

function resolveActivePortalFromLocation(pathname: string) {
  if (pathname === '/uni' || pathname.startsWith('/uni/')) {
    return 'university' as StudentPortalType;
  }

  if (
    pathname === '/auth' ||
    pathname === '/account-setup' ||
    pathname === '/uni/account-setup'
  ) {
    return getStoredStudentPortal();
  }

  return detectStudentPortalFromPath(pathname);
}

function AuthSuccessRedirect() {
  return <Navigate to={studentPortalHome(getStoredStudentPortal())} replace />;
}

function AccountSetupRedirect({
  user,
  profile,
  portal,
}: {
  user: User | null;
  profile: UserProfile | null;
  portal: StudentPortalType;
}) {
  if (user && getStoredStudentPortal() !== portal) {
    return <Navigate to={getStoredStudentPortal() === 'university' ? '/uni/account-setup' : '/account-setup'} replace />;
  }

  return user ? <AccountSetupPage user={user} profile={profile} portal={portal} /> : <Navigate to="/auth" replace />;
}

function StudentPortalShell({
  user,
  profile,
  portal,
}: {
  user: User;
  profile: UserProfile | null;
  portal: StudentPortalType;
}) {
  const location = useLocation();

  useEffect(() => {
    setStoredStudentPortal(portal);
  }, [portal]);

  if (!isPortalProfileComplete(profile, portal) && !location.pathname.endsWith('/account-setup')) {
    return <Navigate to={portal === 'university' ? '/uni/account-setup' : '/account-setup'} replace />;
  }

  if (portal === 'highschool' && getStoredStudentPortal() === 'university') {
    const strippedPath = stripStudentPortalPrefix(location.pathname);
    const target = `${studentPortalPath('university', strippedPath)}${location.search}${location.hash}`;
    return <Navigate to={target} replace />;
  }

  return <Layout user={user} profile={profile} portal={portal} />;
}

function studentPortalChildRoutes(profile: UserProfile | null, user: User) {
  return (
    <>
      <Route index element={<Dashboard profile={profile} />} />
      <Route path="classes" element={<MyClasses />} />
      <Route path="announcements" element={<AnnouncementsPage />} />
      <Route path="classes/:subjectName" element={<ClassDetailPage />} />
      <Route path="plan" element={<PlanDashboardPage />} />
      <Route path="homework-planner" element={<HomeworkPlannerPage />} />
      <Route path="homework-planner-uni" element={<HomeworkPlannerPage />} />
      <Route path="homework-timetable" element={<HomeworkTimetablePage />} />
      <Route path="notes" element={<NotesPage />} />
      <Route path="the-brain" element={<TheBrainPage />} />
      <Route path="the-brain-uni" element={<TheBrainPage />} />
      <Route path="timetable" element={<TimetablePage />} />
      <Route path="timetable/calendar" element={<CalendarYearPage />} />
      <Route path="daily-planner" element={<DailyPlannerPage />} />
      <Route path="daily-planner-uni" element={<DailyPlannerPage />} />
      <Route path="todo" element={<TodoListPage />} />
      <Route path="todo-uni" element={<TodoListPage />} />
      <Route path="deadlines" element={<DeadlinesPage />} />
      <Route path="deadlines-uni" element={<DeadlinesPage />} />
      <Route path="study-hub" element={<StudyHubPage />} />
      <Route path="exam-portal-uni" element={<StudyHubPage initialView="exam" />} />
      <Route path="assignment-portal" element={<AssignmentPortalPage />} />
      <Route path="assignment-portal/:planId" element={<AssignmentPortalPage />} />
      <Route path="assignment-portal-uni" element={<AssignmentPortalPage />} />
      <Route path="assignment-portal-uni/:planId" element={<AssignmentPortalPage />} />
      <Route path="assignment-coach" element={<AssignmentCoachPage />} />
      <Route path="assignment-coach/:planId" element={<AssignmentCoachPage />} />
      <Route path="assignment-coach/:planId/rubric-marking" element={<RubricMarkingPage />} />
      <Route path="assignment-coach-uni" element={<AssignmentCoachPage />} />
      <Route path="assignment-coach-uni/:planId" element={<AssignmentCoachPage />} />
      <Route path="assignment-coach-uni/:planId/rubric-marking" element={<RubricMarkingPage />} />
      <Route path="quiz-game" element={<QuizGamePage />} />
      <Route path="games" element={<GamesPage />} />
      <Route path="games/memory-cards" element={<MemoryCardsGamePage />} />
      <Route path="games/knowledge-tree" element={<KnowledgeTreeGamePage />} />
      <Route path="games/space-quest" element={<SpaceKnowledgeQuestGamePage />} />
      <Route path="games/math-racer" element={<MathRacerGamePage />} />
      <Route path="games/atlas-adventure" element={<AtlasAdventureGamePage />} />
      <Route path="games/trivia-run" element={<TriviaRunGamePage />} />
      <Route path="study" element={<StudyTools profile={profile} />} />
      <Route path="study-uni" element={<StudyTools profile={profile} />} />
      <Route path="lecture-lift-uni" element={<UniversityLectureLiftPage />} />
      <Route path="assignment-studio-uni" element={<UniversityAssignmentStudioPage />} />
      <Route path="research-desk-uni" element={<ResearchDeskPage />} />
      <Route path="teamwork-uni" element={<TeamworkPage />} />
      <Route path="meeting-room-uni" element={<MeetingRoomPage />} />
      <Route path="report-builder-uni" element={<UniversityReportBuilderPage profile={profile} />} />
      <Route path="assistant" element={<AIAssistant profile={profile} />} />
      <Route path="assistant-uni" element={<AIAssistant profile={profile} />} />
      <Route path="workbooks" element={<WorkbookPage profile={profile} />} />
      <Route path="workbooks/word" element={<WordOnlinePage profile={profile} />} />
      <Route path="workbooks/work" element={<WordOnlinePage profile={profile} />} />
      <Route path="workbooks/microsoft-word" element={<MicrosoftWordWorkbookPage profile={profile} />} />
      <Route path="workbooks-uni" element={<WorkbookPage profile={profile} />} />
      <Route path="workbooks-uni/word" element={<WordOnlinePage profile={profile} />} />
      <Route path="workbooks-uni/work" element={<WordOnlinePage profile={profile} />} />
      <Route path="workbooks-uni/microsoft-word" element={<MicrosoftWordWorkbookPage profile={profile} />} />
      <Route path="class-notes" element={<ClassNotesPage />} />
      <Route path="class-notes-uni" element={<ClassNotesPage />} />
      <Route path="resources" element={<ResourceHub profile={profile} />} />
      <Route path="resources-uni" element={<ResourceHub profile={profile} />} />
      <Route path="calculator" element={<AdvancedCalculatorPage />} />
      <Route path="calculator-uni" element={<AdvancedCalculatorPage />} />
      <Route path="math-solver" element={<MathSolverPage />} />
      <Route path="math-solver-uni" element={<MathSolverPage />} />
      <Route path="formula-explainer" element={<FormulaExplainerPage profile={profile} />} />
      <Route path="formula-explainer-uni" element={<FormulaExplainerPage profile={profile} />} />
      <Route path="practice-quiz" element={<PracticeQuizPage />} />
      <Route path="practice-quiz-uni" element={<PracticeQuizPage />} />
      <Route path="question-breakdown" element={<QuestionBreakdownPage />} />
      <Route path="question-breakdown-uni" element={<QuestionBreakdownPage />} />
      <Route path="mind-maps" element={<MindMapsPage />} />
      <Route path="mind-maps-uni" element={<MindMapsPage />} />
      <Route path="learning-profile" element={<LearningProfilePage />} />
      <Route path="learning-profile-uni" element={<LearningProfilePage />} />
      <Route path="library" element={<LibraryPage />} />
      <Route path="library-uni" element={<LibraryPage />} />
      <Route path="email" element={<EmailPage />} />
      <Route path="programs" element={<ProgramsPage profile={profile} />} />
      <Route path="beyond-school" element={<BeyondSchoolPage profile={profile} />} />
      <Route path="motivation-wall" element={<MotivationWallPage />} />
      <Route path="stem-initiatives" element={<StemInitiativesPage />} />
      <Route path="timer" element={<TimerPage />} />
      <Route path="timer-uni" element={<TimerPage />} />
      <Route path="ambient-soundscapes" element={<FocusMediaLibraryPage type="soundscapes" />} />
      <Route path="study-wallpapers" element={<FocusMediaLibraryPage type="wallpapers" />} />
      <Route path="rewards" element={<RewardsPage />} />
      <Route path="growth" element={<GrowthPage />} />
      <Route path="growth-uni" element={<GrowthPage />} />
      <Route path="academic-goals" element={<AcademicGoalsPage />} />
      <Route path="academic-goals-uni" element={<AcademicGoalsPage />} />
      <Route path="progress" element={<ProgressPage />} />
      <Route path="progress-uni" element={<ProgressPage />} />
      <Route path="forest-world" element={<ForestWorldPage />} />
      <Route path="class-progress" element={<ClassProgressPage />} />
      <Route path="profile" element={<ProfilePage profile={profile} />} />
      <Route path="social" element={<SocialPage />} />
      <Route path="mood-logs" element={<MoodLogsPage />} />
      <Route path="teacher" element={<TeacherPage />} />
      <Route path="community" element={<div className="p-8 text-center text-zinc-500">Chats feature coming soon!</div>} />
      <Route path="mood" element={<div className="p-8 text-center text-zinc-500">Diary feature coming soon!</div>} />
      <Route path="settings" element={<SettingsPage user={user} profile={profile} />} />
      <Route path="settings/admins" element={<AdminSettingsPage />} />
      <Route path="admin/app-admin" element={<AppAdminPortal />} />
      <Route path="admin/school-head" element={<SchoolHeadPortal />} />
      <Route path="admin/teacher" element={<Navigate to="/teacher-portal" replace />} />
      <Route path="admin/teacher/tickets" element={<Navigate to="/teacher-portal" replace />} />
      <Route path="admin/teacher/progress" element={<Navigate to="/teacher-portal" replace />} />
      <Route path="admin/teacher/quizzes" element={<Navigate to="/teacher-portal" replace />} />
      <Route path="admin/student" element={<Dashboard profile={profile} />} />
      <Route path="settings/admin" element={<AdminSettingsPage />} />
    </>
  );
}

export default function App() {
  // NOTE: This application is currently configured as the Student Portal.
  // Future portal implementations (Teacher, School Head, App Admin) should be
  // structured to coexist or replace this based on user role.
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileBootstrapFailed, setProfileBootstrapFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const forceDeletedAuthScreen =
    typeof window !== 'undefined' &&
    !user &&
    window.location.pathname === '/auth' &&
    new URLSearchParams(window.location.search).get('deleted') === '1';
  const forcePortalChoiceScreen =
    typeof window !== 'undefined' &&
    window.location.pathname === '/auth' &&
    new URLSearchParams(window.location.search).get('switch') === '1';
  const isAuthRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/auth');

  useEffect(() => {
    const loadingFallback = window.setTimeout(() => {
      setLoading(false);
    }, 2500);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const activePortal =
            typeof window !== 'undefined'
              ? resolveActivePortalFromLocation(window.location.pathname)
              : getStoredStudentPortal();
          setStoredStudentPortal(activePortal);
          setProfileBootstrapFailed(false);
          setUser(firebaseUser);
          const fallbackProfile = withAccountProfileFields({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || (firebaseUser.isAnonymous ? 'Guest User' : 'Student'),
            photoURL: firebaseUser.photoURL || '',
            role: 'student',
            createdAt: new Date().toISOString(),
            accountType: firebaseUser.isAnonymous ? 'guest' : 'member',
            aiAccessEnabled: !firebaseUser.isAnonymous,
            username: '',
            usernameLower: '',
            pronouns: 'prefer-not-to-say',
            gradeLevel: '',
            schoolName: '',
            institutionName: '',
            universityStudyLevel: '',
            degreeProgram: '',
            secondDegreeProgram: '',
            majors: [],
            minors: [],
            studentNumber: '',
          }, firebaseUser);
          const cachedProfile =
            typeof window !== 'undefined'
              ? (() => {
                  try {
                    const raw = window.localStorage.getItem(profileCacheKey(activePortal));
                    if (!raw) return null;
                    const parsed = JSON.parse(raw) as UserProfile | null;
                    return parsed?.uid === firebaseUser.uid ? withAccountProfileFields(parsed, firebaseUser) : null;
                  } catch {
                    return null;
                  }
                })()
              : null;

          const immediateProfile = cachedProfile || fallbackProfile;
          setProfile(immediateProfile);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(profileCacheKey(activePortal), JSON.stringify(immediateProfile));
          }
          window.clearTimeout(loadingFallback);
          setLoading(false);

          try {
            if (firebaseUser.uid === APP_REVIEW_UID) {
              await ensureAppReviewDemoDataForBothPortals(firebaseUser.uid, activePortal);
            }

            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const existingProfile = userDoc.data() as UserProfile;
              const nextProfile = withAccountProfileFields(existingProfile, firebaseUser);

              if (
                existingProfile.pronouns !== nextProfile.pronouns ||
                existingProfile.gradeLevel !== nextProfile.gradeLevel ||
                existingProfile.schoolName !== nextProfile.schoolName ||
                existingProfile.institutionName !== nextProfile.institutionName ||
                existingProfile.universityStudyLevel !== nextProfile.universityStudyLevel ||
                existingProfile.degreeProgram !== nextProfile.degreeProgram ||
                existingProfile.secondDegreeProgram !== nextProfile.secondDegreeProgram ||
                JSON.stringify(existingProfile.majors || []) !== JSON.stringify(nextProfile.majors || []) ||
                JSON.stringify(existingProfile.minors || []) !== JSON.stringify(nextProfile.minors || []) ||
                existingProfile.studentNumber !== nextProfile.studentNumber ||
                existingProfile.displayName !== nextProfile.displayName ||
                existingProfile.photoURL !== nextProfile.photoURL ||
                existingProfile.email !== nextProfile.email ||
                existingProfile.accountType !== nextProfile.accountType ||
                existingProfile.aiAccessEnabled !== nextProfile.aiAccessEnabled ||
                existingProfile.username !== nextProfile.username ||
                existingProfile.usernameLower !== nextProfile.usernameLower
              ) {
                await setDoc(doc(db, 'users', firebaseUser.uid), nextProfile, { merge: true });
              }

              if (nextProfile.accountType !== 'guest') {
                await syncUserDirectoryAcrossPortals(nextProfile, activePortal);
              }

              setProfile(nextProfile);
              if (typeof window !== 'undefined') {
                window.localStorage.setItem(profileCacheKey(activePortal), JSON.stringify(nextProfile));
              }
            } else {
              await setDoc(doc(db, 'users', firebaseUser.uid), fallbackProfile);
              if (fallbackProfile.accountType !== 'guest') {
                await syncUserDirectoryAcrossPortals(fallbackProfile, activePortal);
              }
              setProfile(fallbackProfile);
              if (typeof window !== 'undefined') {
                window.localStorage.setItem(profileCacheKey(activePortal), JSON.stringify(fallbackProfile));
              }
            }
          } catch (profileError) {
            console.error('Profile bootstrap failed:', profileError);
            setProfileBootstrapFailed(true);
          }
        } else {
          setUser(null);
          setProfile(null);
          setProfileBootstrapFailed(false);
        }
      } finally {
        window.clearTimeout(loadingFallback);
        setLoading(false);
      }
    });

    return () => {
      window.clearTimeout(loadingFallback);
      unsubscribe();
    };
  }, []);

  if (loading) {
    if (isAuthRoute) {
      return (
        <ErrorBoundary>
          <Router>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/desktop-browser" element={<DesktopBrowserAuthPage />} />
              <Route path="/auth/desktop-complete" element={<DesktopCompleteAuthPage />} />
            </Routes>
          </Router>
        </ErrorBoundary>
      );
    }

    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-zinc-600 font-medium">Revolutionizing Education...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/auth" element={(!user || forceDeletedAuthScreen || forcePortalChoiceScreen) ? <Auth /> : <AuthSuccessRedirect />} />
          <Route path="/auth/desktop-browser" element={<DesktopBrowserAuthPage />} />
          <Route path="/auth/desktop-complete" element={<DesktopCompleteAuthPage />} />
          <Route
            path="/account-setup"
            element={<AccountSetupRedirect user={user} profile={profile} portal="highschool" />}
          />
          <Route
            path="/uni/account-setup"
            element={<AccountSetupRedirect user={user} profile={profile} portal="university" />}
          />
          <Route path="/teacher-login" element={<TeacherPortalAccess user={user} />} />
          <Route path="/teacher-portal" element={user ? <TeacherPortalAccess user={user} /> : <Navigate to="/auth" replace />} />
          <Route path="/app-admin-login" element={<AppAdminAccess user={user} />} />
          <Route path="/app-admin-portal" element={user ? <AppAdminPortal /> : <Navigate to="/app-admin-login" replace />} />
          <Route path="/school-head-login" element={<SchoolHeadAccess user={user} />} />
          <Route path="/school-head-portal" element={user ? <SchoolHeadPortal /> : <Navigate to="/school-head-login" replace />} />
          <Route
            path="/"
            element={user ? <StudentPortalShell user={user} profile={profile} portal="highschool" /> : <Navigate to="/auth" />}
          >
            {studentPortalChildRoutes(profile, user)}
          </Route>
          <Route
            path="/uni"
            element={user ? <StudentPortalShell user={user} profile={profile} portal="university" /> : <Navigate to="/auth" />}
          >
            {studentPortalChildRoutes(profile, user)}
          </Route>
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
