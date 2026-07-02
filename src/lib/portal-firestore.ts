import {
  collection as firestoreCollection,
  doc as firestoreDoc,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore';
export * from 'firebase/firestore';
import { getStoredStudentPortal } from './portal';

const UNIVERSITY_COLLECTION_PREFIX = 'university';
const UNIVERSITY_COLLECTIONS = new Set([
  'users',
  'flashcards',
  'quizzes',
  'assignments',
  'timetables',
  'planners',
  'todos',
  'deadlines',
  'assignmentPlans',
  'examPlans',
  'mood_logs',
  'brain_summaries',
  'pdf_summaries',
  'notes',
  'teacherTickets',
  'teacherProfiles',
  'formulaExplanations',
  'assistantConversations',
  'qcaa_quizzes',
  'homeworkPlans',
  'studyPlanningProfiles',
  'calendarNotes',
  'flashcardSets',
  'classNotesNotebooks',
  'classNotesSections',
  'classNotesPages',
  'focusSessions',
  'focusStreaks',
  'aiCaches',
  'mathSolverOutputs',
  'userMathSolverOutputs',
  'deletedUsers',
  'usernameIndexes',
  'teamworkProjects',
  'teamworkInvites',
  'researchDeskProjects',
  'userDirectory',
]);

function toUniversityCollectionName(collectionName: string) {
  if (!UNIVERSITY_COLLECTIONS.has(collectionName)) {
    return collectionName;
  }

  return `${UNIVERSITY_COLLECTION_PREFIX}${collectionName.charAt(0).toUpperCase()}${collectionName.slice(1)}`;
}

function shouldPrefixPortalPath(ref: unknown) {
  return Boolean(
    ref &&
      typeof ref === 'object' &&
      'type' in (ref as Record<string, unknown>) &&
      (ref as Record<string, unknown>).type === 'firestore',
  );
}

function withPortalSegments(pathSegments: string[]) {
  if (!pathSegments.length) return pathSegments;
  const portal = getStoredStudentPortal();
  if (portal === 'highschool') {
    return pathSegments;
  }

  const nextSegments = [...pathSegments];
  nextSegments[0] = toUniversityCollectionName(nextSegments[0]);
  return nextSegments;
}

export function collection<AppModelType = unknown, DbModelType extends AppModelType = AppModelType>(
  parent:
    | Firestore
    | CollectionReference<AppModelType, DbModelType>
    | DocumentReference<AppModelType, DbModelType>,
  path: string,
  ...pathSegments: string[]
) {
  if (shouldPrefixPortalPath(parent)) {
    return firestoreCollection(parent as Firestore, ...withPortalSegments([path, ...pathSegments]));
  }

  return firestoreCollection(
    parent as CollectionReference<AppModelType, DbModelType> | DocumentReference<AppModelType, DbModelType>,
    path,
    ...pathSegments,
  );
}

export function doc<AppModelType = unknown, DbModelType extends AppModelType = AppModelType>(
  parent:
    | Firestore
    | CollectionReference<AppModelType, DbModelType>
    | DocumentReference<AppModelType, DbModelType>,
  path?: string,
  ...pathSegments: string[]
) {
  if (shouldPrefixPortalPath(parent)) {
    if (typeof path === 'string') {
      return firestoreDoc(parent as Firestore, ...withPortalSegments([path, ...pathSegments]));
    }

    return firestoreDoc(parent as Firestore);
  }

  if (typeof path === 'string') {
    return firestoreDoc(
      parent as CollectionReference<AppModelType, DbModelType> | DocumentReference<AppModelType, DbModelType>,
      path,
      ...pathSegments,
    );
  }

  return firestoreDoc(
    parent as CollectionReference<AppModelType, DbModelType> | DocumentReference<AppModelType, DbModelType>,
  );
}
