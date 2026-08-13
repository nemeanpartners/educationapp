import { doc, getDoc, setDoc } from '@/lib/portal-firestore';
import { db } from '../firebase';
import type { UserProfile } from '../types';

const GLOBAL_USER_PROFILE_COLLECTION = 'globalUserProfiles';

export type GlobalUserProfileFields = Pick<
  UserProfile,
  | 'displayName'
  | 'photoURL'
  | 'email'
  | 'pronouns'
  | 'schoolName'
  | 'gradeLevel'
  | 'institutionName'
  | 'universityStudyLevel'
  | 'degreeProgram'
  | 'secondDegreeProgram'
  | 'majors'
  | 'minors'
  | 'studentNumber'
>;

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => cleanString(item)).filter(Boolean)
    : [];
}

export function buildGlobalUserProfilePatch(profile: Partial<UserProfile>): Partial<GlobalUserProfileFields> {
  const patch: Partial<GlobalUserProfileFields> = {};

  const stringFields: Array<keyof GlobalUserProfileFields> = [
    'displayName',
    'photoURL',
    'email',
    'pronouns',
    'schoolName',
    'gradeLevel',
    'institutionName',
    'universityStudyLevel',
    'degreeProgram',
    'secondDegreeProgram',
    'studentNumber',
  ];

  for (const field of stringFields) {
    const value = cleanString(profile[field]);
    if (value) {
      patch[field] = value as never;
    }
  }

  const majors = cleanList(profile.majors);
  if (majors.length) {
    patch.majors = majors;
  }

  const minors = cleanList(profile.minors);
  if (minors.length) {
    patch.minors = minors;
  }

  return patch;
}

export async function loadGlobalUserProfile(uid: string) {
  const snapshot = await getDoc(doc(db, GLOBAL_USER_PROFILE_COLLECTION, uid));
  return snapshot.exists() ? (snapshot.data() as Partial<GlobalUserProfileFields>) : null;
}

export async function saveGlobalUserProfile(uid: string, profile: Partial<UserProfile>) {
  const patch = buildGlobalUserProfilePatch(profile);
  if (!Object.keys(patch).length) {
    return;
  }

  await setDoc(
    doc(db, GLOBAL_USER_PROFILE_COLLECTION, uid),
    {
      uid,
      ...patch,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export function mergeGlobalUserProfile(profile: UserProfile, globalProfile: Partial<GlobalUserProfileFields> | null): UserProfile {
  if (!globalProfile) return profile;

  return {
    ...profile,
    displayName: profile.displayName || globalProfile.displayName || '',
    photoURL: profile.photoURL || globalProfile.photoURL || '',
    email: profile.email || globalProfile.email || '',
    pronouns: globalProfile.pronouns || profile.pronouns || 'prefer-not-to-say',
    schoolName: globalProfile.schoolName || profile.schoolName || '',
    gradeLevel: globalProfile.gradeLevel || profile.gradeLevel || '',
    institutionName: globalProfile.institutionName || profile.institutionName || '',
    universityStudyLevel: globalProfile.universityStudyLevel || profile.universityStudyLevel || '',
    degreeProgram: globalProfile.degreeProgram || profile.degreeProgram || '',
    secondDegreeProgram: globalProfile.secondDegreeProgram || profile.secondDegreeProgram || '',
    majors: Array.isArray(globalProfile.majors) && globalProfile.majors.length ? globalProfile.majors : (profile.majors || []),
    minors: Array.isArray(globalProfile.minors) && globalProfile.minors.length ? globalProfile.minors : (profile.minors || []),
    studentNumber: globalProfile.studentNumber || profile.studentNumber || '',
  };
}
