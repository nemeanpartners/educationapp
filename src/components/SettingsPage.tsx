import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from '@/lib/portal-firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { AlertTriangle, CheckCircle2, Image as ImageIcon, Loader2, MailPlus, Moon, Monitor, Palette, School, Sun, Upload, UserRound, XCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { BackgroundPage, PageBackgroundSetting, PageBackgrounds, UserProfile } from '../types';
import { auth, db, storage } from '../firebase';
import {
  APP_THEME_PALETTES,
  AppThemePreference,
  ThemeMode,
  ThemePaletteId,
  getStoredThemePreference,
  saveThemePreference,
} from '../lib/theme';
import { cn } from '../lib/utils';
import { BACKGROUND_CATEGORIES, BACKGROUND_COLORS, BACKGROUND_PRESETS, DEFAULT_BACKGROUND } from '../lib/backgrounds';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { detectStudentPortalFromPath } from '@/lib/portal';

interface SettingsPageProps {
  user: User;
  profile: UserProfile | null;
}

type TeamworkInvite = {
  id: string;
  projectId: string;
  projectTitle: string;
  fromUserId: string;
  fromName: string;
  fromEmail: string;
  toUserId: string;
  toName: string;
  toEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt?: any;
  updatedAt?: any;
};

type TeamMember = {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
};

function normalizeSettingsTeamMember(member: Partial<TeamMember> | string | null | undefined, index = 0): TeamMember {
  if (typeof member === 'string') {
    return {
      uid: `legacy-${index}-${member}`,
      displayName: member,
      email: '',
    };
  }

  return {
    uid: typeof member?.uid === 'string' && member.uid ? member.uid : `legacy-${index}`,
    displayName:
      typeof member?.displayName === 'string' && member.displayName.trim()
        ? member.displayName
        : typeof member?.email === 'string' && member.email
          ? member.email.split('@')[0]
          : 'University member',
    email: typeof member?.email === 'string' ? member.email : '',
    photoURL: typeof member?.photoURL === 'string' ? member.photoURL : '',
  };
}

const THEME_MODES: Array<{
  id: ThemeMode;
  label: string;
  description: string;
  icon: typeof Monitor;
}> = [
  {
    id: 'default',
    label: 'Default',
    description: 'Use the original EduRev color balance.',
    icon: Monitor,
  },
  {
    id: 'light',
    label: 'Light',
    description: 'Keep surfaces bright and high contrast.',
    icon: Sun,
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Switch the system colors to deeper surfaces.',
    icon: Moon,
  },
];

const BACKGROUND_PAGES: Array<{ id: BackgroundPage; label: string; description: string }> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Choose the background behind your workspace and daily overview.',
  },
  {
    id: 'profile',
    label: 'Profile',
    description: 'Choose the background behind your profile experience.',
  },
];

const PRONOUN_OPTIONS: Array<{ id: NonNullable<UserProfile['pronouns']>; label: string }> = [
  { id: 'she/her', label: 'She / her' },
  { id: 'he/him', label: 'He / him' },
  { id: 'they/them', label: 'They / them' },
  { id: 'prefer-not-to-say', label: 'Prefer not to say' },
];

const UNIVERSITY_STUDY_LEVEL_OPTIONS = [
  'Bachelor',
  'Double Degree',
  'Bachelor Honours',
  'Masters',
  'PhD',
  'Graduate Diploma',
  'Graduate Certificate',
  'Associate Degree',
  'Other',
];

const ACCOUNT_DELETION_REASONS = [
  'I am creating a new account',
  'I no longer use EduRev',
  'I am concerned about privacy',
  'I had trouble using the app',
  'Other',
];

const DIRECT_USER_DOC_COLLECTIONS = ['users', 'timetables', 'homeworkPlans', 'calendarNotes', 'focusStreaks', 'mood_logs', 'teacherProfiles'] as const;
const USER_ID_COLLECTIONS = [
  'assignments',
  'assignmentPlans',
  'assistantConversations',
  'brain_summaries',
  'classNotesNotebooks',
  'classNotesPages',
  'classNotesSections',
  'deadlines',
  'examPlans',
  'flashcardSets',
  'flashcards',
  'focusSessions',
  'formulaExplanations',
  'notes',
  'pdf_summaries',
  'planners',
  'qcaa_quizzes',
  'quizzes',
  'teacherTickets',
  'todos',
] as const;

async function archiveRecord(archiveRootRef: ReturnType<typeof doc>, sourceCollection: string, originalId: string, data: Record<string, unknown>, path: string) {
  await setDoc(doc(collection(archiveRootRef, 'records'), `${sourceCollection}__${originalId}`), {
    sourceCollection,
    originalId,
    path,
    data,
    archivedAt: new Date().toISOString(),
  });
}

async function archiveAndResetAccount(user: User, profile: UserProfile | null, reason: string) {
  const archiveRootRef = doc(db, 'deletedUsers', user.uid);
  const archivedAt = new Date().toISOString();

  await setDoc(archiveRootRef, {
    uid: user.uid,
    email: user.email || profile?.email || '',
    displayName: profile?.displayName || user.displayName || 'Student',
    photoURL: profile?.photoURL || user.photoURL || '',
    reason,
    deletedAt: archivedAt,
    role: profile?.role || 'student',
    profile: profile || null,
    authProviders: user.providerData.map((provider) => provider.providerId),
  });

  for (const collectionName of DIRECT_USER_DOC_COLLECTIONS) {
    const sourceRef = doc(db, collectionName, user.uid);
    const snap = await getDoc(sourceRef);
    if (!snap.exists()) continue;
    await archiveRecord(archiveRootRef, collectionName, snap.id, snap.data() as Record<string, unknown>, `${collectionName}/${snap.id}`);
    await deleteDoc(sourceRef);
  }

  for (const collectionName of USER_ID_COLLECTIONS) {
    const sourceQuery = query(collection(db, collectionName), where('userId', '==', user.uid));
    const sourceSnap = await getDocs(sourceQuery);

    for (const sourceDoc of sourceSnap.docs) {
      await archiveRecord(archiveRootRef, collectionName, sourceDoc.id, sourceDoc.data() as Record<string, unknown>, `${collectionName}/${sourceDoc.id}`);

      if (collectionName === 'assignments') {
        const pagesSnap = await getDocs(collection(db, 'assignments', sourceDoc.id, 'pages'));
        for (const pageDoc of pagesSnap.docs) {
          await archiveRecord(
            archiveRootRef,
            'assignments-pages',
            `${sourceDoc.id}__${pageDoc.id}`,
            pageDoc.data() as Record<string, unknown>,
            `assignments/${sourceDoc.id}/pages/${pageDoc.id}`,
          );
          await deleteDoc(pageDoc.ref);
        }
      }

      await deleteDoc(sourceDoc.ref);
    }
  }
}

function splitStudyItems(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function SettingsPage({ user, profile }: SettingsPageProps) {
  const location = useLocation();
  const isUniversityPortal = detectStudentPortalFromPath(location.pathname) === 'university';
  const [themePreference, setThemePreference] = useState<AppThemePreference>(() => getStoredThemePreference());
  const [backgrounds, setBackgrounds] = useState<PageBackgrounds>(() => profile?.backgrounds || {});
  const [selectedPronouns, setSelectedPronouns] = useState<NonNullable<UserProfile['pronouns']>>(profile?.pronouns || 'prefer-not-to-say');
  const [displayNameInput, setDisplayNameInput] = useState(profile?.displayName || user.displayName || 'Student');
  const [institutionInput, setInstitutionInput] = useState(profile?.institutionName || '');
  const [universityStudyLevelInput, setUniversityStudyLevelInput] = useState(profile?.universityStudyLevel || 'Bachelor');
  const [degreeInput, setDegreeInput] = useState(profile?.degreeProgram || '');
  const [secondDegreeInput, setSecondDegreeInput] = useState(profile?.secondDegreeProgram || '');
  const [majorsInput, setMajorsInput] = useState((profile?.majors || []).join(', '));
  const [minorsInput, setMinorsInput] = useState((profile?.minors || []).join(', '));
  const [studentNumberInput, setStudentNumberInput] = useState(profile?.studentNumber || '');
  const [gradeLevelInput, setGradeLevelInput] = useState(profile?.gradeLevel || '');
  const [schoolNameInput, setSchoolNameInput] = useState(profile?.schoolName || '');
  const [savingPage, setSavingPage] = useState<BackgroundPage | null>(null);
  const [uploadingPage, setUploadingPage] = useState<BackgroundPage | null>(null);
  const [presetPickerPage, setPresetPickerPage] = useState<BackgroundPage | null>(null);
  const [activeBackgroundTools, setActiveBackgroundTools] = useState<Record<BackgroundPage, 'color' | 'custom'>>({
    dashboard: 'color',
    profile: 'color',
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [deleteReason, setDeleteReason] = useState(ACCOUNT_DELETION_REASONS[0]);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [teamworkInvites, setTeamworkInvites] = useState<TeamworkInvite[]>([]);
  const [teamworkInviteMessage, setTeamworkInviteMessage] = useState('');
  const appVersion = '1.0.0';

  useEffect(() => {
    if (!isUniversityPortal) {
      setTeamworkInvites([]);
      return;
    }

    const invitesQuery = query(collection(db, 'teamworkInvites'), where('toUserId', '==', user.uid));
    const unsubscribe = onSnapshot(
      invitesQuery,
      (snap) => {
        const items = snap.docs.map((inviteDoc) => ({ id: inviteDoc.id, ...(inviteDoc.data() as any) })) as TeamworkInvite[];
        setTeamworkInvites(items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      },
      (error) => {
        console.error('Settings teamwork invitations listener failed:', error);
        setTeamworkInviteMessage('Could not load teamwork invitations. Check account permissions and try again.');
      },
    );

    return () => unsubscribe();
  }, [isUniversityPortal, user.uid]);

  const selectedPalette = useMemo(
    () => APP_THEME_PALETTES.find((palette) => palette.id === themePreference.paletteId) || APP_THEME_PALETTES[0],
    [themePreference.paletteId],
  );

  const updateTheme = (nextPreference: AppThemePreference) => {
    setThemePreference(nextPreference);
    saveThemePreference(nextPreference);
  };

  const respondToTeamworkInvite = async (invite: TeamworkInvite, status: 'accepted' | 'declined') => {
    setTeamworkInviteMessage('');
    try {
      if (status === 'accepted') {
        const projectRef = doc(db, 'teamworkProjects', invite.projectId);
        const projectSnap = await getDoc(projectRef);
        if (projectSnap.exists()) {
          const project = projectSnap.data() as any;
          const currentProfiles = Array.isArray(project.memberProfiles)
            ? project.memberProfiles.map((member: Partial<TeamMember> | string, index: number) => normalizeSettingsTeamMember(member, index))
            : [];
          const nextMember: TeamMember = {
            uid: user.uid,
            displayName: profile?.displayName || user.displayName || invite.toName || user.email?.split('@')[0] || 'Student',
            email: user.email || invite.toEmail || '',
            photoURL: user.photoURL || profile?.photoURL || '',
          };
          const nextProfiles = Array.from(
            new Map([...currentProfiles, nextMember].map((member) => [member.uid, member])).values(),
          );

          await updateDoc(projectRef, {
            memberUserIds: Array.from(new Set([...(Array.isArray(project.memberUserIds) ? project.memberUserIds : []), user.uid])),
            memberProfiles: nextProfiles,
            members: nextProfiles.map((member) => member.displayName),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await updateDoc(doc(db, 'teamworkInvites', invite.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      setTeamworkInviteMessage(status === 'accepted' ? 'Teamwork invitation accepted.' : 'Teamwork invitation declined.');
    } catch (error) {
      console.error('Teamwork invite response failed:', error);
      setTeamworkInviteMessage('Could not update the teamwork invitation. Please try again.');
    }
  };

  const saveBackground = async (page: BackgroundPage, setting: PageBackgroundSetting) => {
    setSavingPage(page);
    setStatusMessage('');
    const nextBackgrounds = {
      ...backgrounds,
      [page]: setting,
    };

    try {
      await setDoc(doc(db, 'users', user.uid), { backgrounds: nextBackgrounds }, { merge: true });
      setBackgrounds(nextBackgrounds);
      setStatusMessage(`${page === 'dashboard' ? 'Dashboard' : 'Profile'} background saved.`);
    } catch (error) {
      console.error('Background save failed:', error);
      setStatusMessage('Could not save the background. Please try again.');
    } finally {
      setSavingPage(null);
    }
  };

  const uploadCustomBackground = async (page: BackgroundPage, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMessage('Please choose an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage('Please choose an image under 5 MB.');
      return;
    }

    setUploadingPage(page);
    setStatusMessage('');
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const fileRef = ref(storage, `user-backgrounds/${user.uid}/${page}/${Date.now()}-${safeName}`);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      await saveBackground(page, { mode: 'custom', url, overlay: backgrounds[page]?.overlay || 'clear' });
    } catch (error) {
      console.error('Background upload failed:', error);
      setStatusMessage('Could not upload the image. Please try a different file.');
    } finally {
      setUploadingPage(null);
    }
  };

  const updateCustomUrl = (page: BackgroundPage, url: string) => {
    setBackgrounds((current) => ({
      ...current,
      [page]: { mode: 'custom', url, overlay: current[page]?.overlay || 'clear' },
    }));
  };

  const setActiveBackgroundTool = (page: BackgroundPage, tool: 'color' | 'custom') => {
    setActiveBackgroundTools((current) => ({
      ...current,
      [page]: tool,
    }));
  };

  const saveOverlay = (page: BackgroundPage, overlay: 'clear' | 'blur') => {
    const current = backgrounds[page] || DEFAULT_BACKGROUND;
    saveBackground(page, { ...current, overlay });
  };

  const savePronouns = async () => {
    setStatusMessage('');
    try {
      await setDoc(doc(db, 'users', user.uid), { pronouns: selectedPronouns }, { merge: true });
      setStatusMessage('Pronouns saved to your profile.');
    } catch (error) {
      console.error('Pronouns save failed:', error);
      setStatusMessage('Could not save pronouns. Please try again.');
    }
  };

  const saveProfileDetails = async () => {
    const cleanDisplayName = displayNameInput.trim() || user.displayName || 'Student';
    const cleanStudentNumber = studentNumberInput.trim();
    const cleanInstitution = institutionInput.trim();
    const cleanUniversityStudyLevel = universityStudyLevelInput.trim();
    const cleanDegree = degreeInput.trim();
    const cleanSecondDegree = secondDegreeInput.trim();
    const cleanMajors = splitStudyItems(majorsInput);
    const cleanMinors = splitStudyItems(minorsInput);
    const cleanGradeLevel = gradeLevelInput.trim();
    const cleanSchoolName = schoolNameInput.trim();

    setStatusMessage('');

    const shouldResetCareerDirection =
      isUniversityPortal &&
      (
        cleanInstitution !== (profile?.institutionName || '').trim() ||
        cleanUniversityStudyLevel !== (profile?.universityStudyLevel || '').trim() ||
        cleanDegree !== (profile?.degreeProgram || '').trim() ||
        cleanSecondDegree !== (profile?.secondDegreeProgram || '').trim() ||
        JSON.stringify(cleanMajors) !== JSON.stringify(profile?.majors || []) ||
        JSON.stringify(cleanMinors) !== JSON.stringify(profile?.minors || [])
      );

    try {
      const nextProfilePatch: Partial<UserProfile> = {
        displayName: cleanDisplayName,
        pronouns: selectedPronouns,
        studentNumber: cleanStudentNumber,
        institutionName: isUniversityPortal ? cleanInstitution : '',
        universityStudyLevel: isUniversityPortal ? cleanUniversityStudyLevel : '',
        degreeProgram: isUniversityPortal ? cleanDegree : '',
        secondDegreeProgram: isUniversityPortal ? cleanSecondDegree : '',
        majors: isUniversityPortal ? cleanMajors : [],
        minors: isUniversityPortal ? cleanMinors : [],
        gradeLevel: isUniversityPortal ? '' : cleanGradeLevel,
        schoolName: isUniversityPortal ? '' : cleanSchoolName,
      };

      await setDoc(
        doc(db, 'users', user.uid),
        {
          ...nextProfilePatch,
          ...(shouldResetCareerDirection ? { beyondUniversityCareerDirection: deleteField() } : {}),
        },
        { merge: true },
      );

      if (isUniversityPortal) {
        await setDoc(
          doc(db, 'userDirectory', user.uid),
          {
            uid: user.uid,
            displayName: cleanDisplayName,
            email: profile?.email || user.email || '',
            emailLower: (profile?.email || user.email || '').toLowerCase().trim(),
            photoURL: profile?.photoURL || user.photoURL || '',
            institutionName: cleanInstitution,
            universityStudyLevel: cleanUniversityStudyLevel,
            degreeProgram: cleanDegree,
            secondDegreeProgram: cleanSecondDegree,
            majors: cleanMajors,
            minors: cleanMinors,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }

      try {
        const cacheKey = `edurev-user-profile-cache-${isUniversityPortal ? 'university' : 'highschool'}`;
        const cachedProfile = {
          ...(profile || {}),
          uid: user.uid,
          email: profile?.email || user.email || '',
          displayName: cleanDisplayName,
          photoURL: profile?.photoURL || user.photoURL || '',
          role: profile?.role || 'student',
          createdAt: profile?.createdAt || new Date().toISOString(),
          pronouns: selectedPronouns,
          studentNumber: cleanStudentNumber,
          institutionName: isUniversityPortal ? cleanInstitution : '',
          universityStudyLevel: isUniversityPortal ? cleanUniversityStudyLevel : '',
          degreeProgram: isUniversityPortal ? cleanDegree : '',
          secondDegreeProgram: isUniversityPortal ? cleanSecondDegree : '',
          majors: isUniversityPortal ? cleanMajors : [],
          minors: isUniversityPortal ? cleanMinors : [],
          gradeLevel: isUniversityPortal ? '' : cleanGradeLevel,
          schoolName: isUniversityPortal ? '' : cleanSchoolName,
          backgrounds,
          beyondUniversityCareerDirection: shouldResetCareerDirection ? undefined : profile?.beyondUniversityCareerDirection,
        };
        window.localStorage.setItem(cacheKey, JSON.stringify(cachedProfile));
      } catch {
        // Ignore local cache write failures.
      }

      setStatusMessage('Student info saved.');
    } catch (error) {
      console.error('Profile save failed:', error);
      setStatusMessage('Could not save student info. Please try again.');
    }
  };

  const requestAccountDeletion = async () => {
    setStatusMessage('');
    setIsDeletingAccount(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('No authenticated user found.');

      const idToken = await currentUser.getIdToken(true);
      const apiKey = auth.app.options.apiKey;
      if (!apiKey) throw new Error('Missing Firebase API key.');

      await archiveAndResetAccount(user, profile, deleteReason);

      try {
        const deleteResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
        });

        if (!deleteResponse.ok) {
          const deletePayload = await deleteResponse.json().catch(() => ({}));
          console.error('Firebase auth account delete failed:', deletePayload);
        }
      } catch (deleteError) {
        console.error('Firebase auth account delete request failed:', deleteError);
      }

      try {
        await auth.signOut();
      } catch (signOutError) {
        console.error('Sign out after deletion failed:', signOutError);
      }

      window.location.replace('/auth?deleted=1');
    } catch (error: any) {
      console.error('Account deletion failed:', error);
      try {
        await auth.signOut();
      } catch (signOutError) {
        console.error('Sign out after deletion error failed:', signOutError);
      }
      window.location.replace('/auth?deleted=1');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const profileDetails = isUniversityPortal
    ? [
        { label: 'Name', value: displayNameInput || 'Student' },
        { label: 'Pronouns', value: PRONOUN_OPTIONS.find((option) => option.id === selectedPronouns)?.label || 'Prefer not to say' },
        { label: 'Institution', value: institutionInput.trim() || 'Not set' },
        { label: 'Study level', value: universityStudyLevelInput.trim() || 'Not set' },
        { label: 'Degree', value: degreeInput.trim() || 'Not set' },
        { label: 'Second degree', value: secondDegreeInput.trim() || 'Not set' },
        { label: 'Majors', value: majorsInput.trim() || 'Not set' },
        { label: 'Minors', value: minorsInput.trim() || 'Not set' },
        { label: 'Student ID', value: studentNumberInput.trim() || 'Not set' },
      ]
    : [
        { label: 'Name', value: displayNameInput || 'Student' },
        { label: 'Pronouns', value: PRONOUN_OPTIONS.find((option) => option.id === selectedPronouns)?.label || 'Prefer not to say' },
        { label: 'Grade level', value: gradeLevelInput.trim() || 'Not set' },
        { label: 'School name', value: schoolNameInput.trim() || 'Not set' },
        { label: 'Student number', value: studentNumberInput.trim() || 'Not set' },
      ];

  const sectionClass = isUniversityPortal
    ? 'rounded-[2rem] border border-white/70 bg-white/62 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-2xl'
    : 'rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm';

  const innerPanelClass = isUniversityPortal
    ? 'rounded-[1.6rem] border border-white/70 bg-white/72 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl'
    : 'rounded-2xl border border-zinc-200 bg-zinc-50 p-4';

  return (
    <div className={cn('space-y-8', isUniversityPortal && 'relative isolate px-1 pb-2')}>
      {isUniversityPortal ? (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2.75rem] bg-[linear-gradient(135deg,rgba(244,251,255,0.96)_0%,rgba(236,247,252,0.92)_42%,rgba(249,252,255,0.98)_100%)]">
          <div className="absolute left-10 top-12 h-64 w-64 rounded-full bg-cyan-100/70 blur-3xl" />
          <div className="absolute right-8 top-24 h-72 w-72 rounded-full bg-sky-100/55 blur-3xl" />
          <div className="absolute bottom-[-3rem] left-1/4 h-80 w-80 rounded-full bg-indigo-100/45 blur-3xl" />
        </div>
      ) : null}
      <div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">Settings</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-900">Account and appearance</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium text-zinc-500">
          {isUniversityPortal
            ? 'Manage your university student details and reload the app colors from the saved theme system.'
            : 'Manage your student details and reload the app colors from the saved theme system.'}
        </p>
      </div>

      {statusMessage ? (
        <div className={cn(isUniversityPortal ? 'rounded-[1.5rem] border border-white/60 bg-white/45 px-4 py-3 text-sm font-bold text-zinc-700 shadow-[0_16px_35px_rgba(15,23,42,0.06)] backdrop-blur-2xl' : 'rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-600')}>
          {statusMessage}
        </div>
      ) : null}

      <div className="grid gap-6">
        <section className={sectionClass}>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <UserRound size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Student info</p>
              <h2 className="mt-1 text-xl font-black text-zinc-900">User card</h2>
            </div>
          </div>

          <div className={cn('mt-6 flex items-center gap-4 p-4', isUniversityPortal ? 'rounded-[1.6rem] border border-white/70 bg-white/72 shadow-[0_14px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl' : 'rounded-2xl bg-zinc-50')}>
            <img
              src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || user.displayName || 'Student')}`}
              alt="User avatar"
              className="h-16 w-16 rounded-2xl border border-white object-cover shadow-sm"
            />
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-zinc-900">{profile?.displayName || user.displayName || 'Student'}</p>
              <p className="truncate text-sm font-bold text-zinc-500">{profile?.email || user.email}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {profileDetails.map((detail) => (
              <div key={detail.label} className={cn(isUniversityPortal ? 'rounded-[1.45rem] border border-white/70 bg-white/72 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.84)] backdrop-blur-xl' : 'rounded-2xl border border-zinc-100 bg-white p-4')}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{detail.label}</p>
                <p className="mt-2 truncate text-sm font-black text-zinc-900">{detail.value}</p>
              </div>
            ))}
          </div>

          <div className={cn('mt-6', innerPanelClass)}>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Edit student info</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="display-name" className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                  Name
                </label>
                <input
                  id="display-name"
                  value={displayNameInput}
                  onChange={(event) => setDisplayNameInput(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label htmlFor="pronouns" className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                  Pronouns
                </label>
                <select
                  id="pronouns"
                  value={selectedPronouns}
                  onChange={(event) => setSelectedPronouns(event.target.value as NonNullable<UserProfile['pronouns']>)}
                  className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:ring-2 focus:ring-indigo-600"
                >
                  {PRONOUN_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {isUniversityPortal ? (
                <>
                  <div>
                    <label htmlFor="institution-name" className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Institution
                    </label>
                    <input
                      id="institution-name"
                      value={institutionInput}
                      onChange={(event) => setInstitutionInput(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>

                  <div>
                    <label htmlFor="study-level" className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Study level
                    </label>
                    <select
                      id="study-level"
                      value={universityStudyLevelInput}
                      onChange={(event) => setUniversityStudyLevelInput(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:ring-2 focus:ring-indigo-600"
                    >
                      {UNIVERSITY_STUDY_LEVEL_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="degree-program" className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Degree
                    </label>
                    <input
                      id="degree-program"
                      value={degreeInput}
                      onChange={(event) => setDegreeInput(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="second-degree-program" className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Second degree for double degree
                    </label>
                    <input
                      id="second-degree-program"
                      value={secondDegreeInput}
                      onChange={(event) => setSecondDegreeInput(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>

                  <div>
                    <label htmlFor="majors" className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Majors
                    </label>
                    <input
                      id="majors"
                      value={majorsInput}
                      onChange={(event) => setMajorsInput(event.target.value)}
                      placeholder="Comma separated"
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>

                  <div>
                    <label htmlFor="minors" className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Minors
                    </label>
                    <input
                      id="minors"
                      value={minorsInput}
                      onChange={(event) => setMinorsInput(event.target.value)}
                      placeholder="Comma separated"
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="grade-level" className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      Grade level
                    </label>
                    <input
                      id="grade-level"
                      value={gradeLevelInput}
                      onChange={(event) => setGradeLevelInput(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>

                  <div>
                    <label htmlFor="school-name" className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      School name
                    </label>
                    <input
                      id="school-name"
                      value={schoolNameInput}
                      onChange={(event) => setSchoolNameInput(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                </>
              )}

              <div>
                <label htmlFor="student-number" className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                  {isUniversityPortal ? 'Student ID' : 'Student number'}
                </label>
                <input
                  id="student-number"
                  value={studentNumberInput}
                  onChange={(event) => setStudentNumberInput(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveProfileDetails}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Save student info
              </button>
              <button
                type="button"
                onClick={savePronouns}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-50"
              >
                Save pronouns only
              </button>
            </div>

            {!isUniversityPortal ? (
              <p className="mt-3 text-sm font-medium text-zinc-500">
                This controls whether the profile orbit shows the STEMHER bubble, STEMHIM bubble, or the shared STEM initiatives label.
              </p>
            ) : null}
          </div>
        </section>

        {isUniversityPortal ? (
          <section className={sectionClass}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <MailPlus size={24} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Teamwork invitations</p>
                  <h2 className="mt-1 text-xl font-black text-zinc-900">Teamwork invitations</h2>
                  <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-zinc-500">
                    Accept or decline project-room invitations from other university users.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500 shadow-sm">
                {teamworkInvites.filter((invite) => invite.status === 'pending').length} pending
              </span>
            </div>

            {teamworkInviteMessage ? (
              <div className="mt-5 rounded-[1.35rem] border border-white/70 bg-white/72 px-4 py-3 text-sm font-bold text-zinc-600 shadow-[0_14px_28px_rgba(15,23,42,0.04)] backdrop-blur-xl">
                {teamworkInviteMessage}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              {teamworkInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="grid gap-4 rounded-[1.45rem] border border-white/70 bg-white/72 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.84)] backdrop-blur-xl lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-black text-zinc-900">{invite.projectTitle || 'Team project'}</p>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                          invite.status === 'accepted'
                            ? 'bg-emerald-50 text-emerald-700'
                            : invite.status === 'declined'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700',
                        )}
                      >
                        {invite.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-zinc-600">
                      Invited by {invite.fromName || invite.fromEmail || 'another student'}
                    </p>
                    <p className="mt-1 truncate text-xs font-bold text-zinc-400">{invite.fromEmail}</p>
                  </div>
                  {invite.status === 'pending' ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => respondToTeamworkInvite(invite, 'accepted')}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-zinc-800"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => respondToTeamworkInvite(invite, 'declined')}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-black text-zinc-700 transition hover:bg-zinc-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Decline
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              {!teamworkInvites.length ? (
                <div className="rounded-[1.45rem] border border-dashed border-white/80 bg-white/52 px-5 py-6 text-sm font-semibold text-zinc-500 shadow-[0_14px_28px_rgba(15,23,42,0.04)] backdrop-blur-xl">
                  No teamwork invitations yet. When another student invites this account, the request appears here with accept and decline actions.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className={sectionClass}>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Palette size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Appearance</p>
              <h2 className="mt-1 text-xl font-black text-zinc-900">System colors and backgrounds</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {THEME_MODES.map((mode) => {
              const Icon = mode.icon;
              const active = themePreference.mode === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => updateTheme({ ...themePreference, mode: mode.id })}
                  className={cn(
                    'min-h-32 rounded-2xl border p-4 text-left transition',
                    active
                      ? 'border-indigo-500 bg-indigo-50/90 text-indigo-600 shadow-lg shadow-zinc-200'
                      : isUniversityPortal
                        ? 'border-white/70 bg-white/72 text-zinc-500 shadow-[0_14px_28px_rgba(15,23,42,0.04)] hover:bg-white hover:text-zinc-900'
                        : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900',
                  )}
                >
                  <Icon size={22} />
                  <p className={cn('mt-4 text-sm font-black', active ? 'text-indigo-600' : 'text-zinc-900')}>{mode.label}</p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-zinc-500">{mode.description}</p>
                </button>
              );
            })}
          </div>

          <div className={cn('mt-6', innerPanelClass)}>
            <label htmlFor="theme-palette" className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
              Theme dropdown
            </label>
            <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <select
                id="theme-palette"
                value={themePreference.paletteId}
                onChange={(event) => updateTheme({ ...themePreference, paletteId: event.target.value as ThemePaletteId })}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:ring-2 focus:ring-indigo-600"
              >
                {APP_THEME_PALETTES.map((palette) => (
                  <option key={palette.id} value={palette.id}>
                    {palette.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                {selectedPalette.swatches.map((swatch) => (
                  <span
                    key={swatch}
                    className="h-8 w-8 rounded-xl border border-white shadow-sm"
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
            </div>
            <p className="mt-3 text-sm font-medium text-zinc-500">{selectedPalette.description}</p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {selectedPalette.swatches.map((swatch, index) => (
              <div key={`${swatch}-${index}`} className={cn(isUniversityPortal ? 'rounded-[1.35rem] border border-white/70 bg-white/72 p-3 shadow-[0_14px_28px_rgba(15,23,42,0.04)] backdrop-blur-xl' : 'rounded-2xl border border-zinc-100 bg-white p-3')}>
                <div className="h-16 rounded-xl" style={{ backgroundColor: swatch }} />
                <p className="mt-3 text-xs font-black text-zinc-900">{swatch}</p>
              </div>
            ))}
          </div>
        </section>

      <section className={sectionClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ImageIcon size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Page backgrounds</p>
              <h2 className="mt-1 text-xl font-black text-zinc-900">Background changer</h2>
              <p className="mt-2 max-w-2xl text-sm font-medium text-zinc-500">
                Choose a color, an included image preset, or upload your own image. Dashboard and Profile save independently.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 2xl:grid-cols-2">
          {BACKGROUND_PAGES.map((pageConfig) => {
            const setting = backgrounds[pageConfig.id] || DEFAULT_BACKGROUND;
            const customUrl = setting.mode === 'custom' ? setting.url || '' : '';
            const saving = savingPage === pageConfig.id;
            const uploading = uploadingPage === pageConfig.id;
            const activeTool = setting.mode === 'preset' ? 'preset' : activeBackgroundTools[pageConfig.id];
            const selectedPreset = BACKGROUND_PRESETS.find((preset) => preset.url === setting.url);
            const canUseOverlay = setting.mode === 'preset' || setting.mode === 'custom';
            const overlay = setting.overlay || 'clear';

            return (
              <div key={pageConfig.id} className="rounded-3xl border border-zinc-100 bg-zinc-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-zinc-900">{pageConfig.label}</h3>
                    <p className="mt-1 text-sm font-medium leading-6 text-zinc-500">{pageConfig.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveBackground(pageConfig.id, DEFAULT_BACKGROUND)}
                    disabled={saving || uploading}
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-black text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reset
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-2 rounded-2xl border border-zinc-200 bg-white p-1 sm:grid-cols-3">
                  {[
                    { id: 'color' as const, label: 'Color' },
                    { id: 'preset' as const, label: 'Image presets' },
                    { id: 'custom' as const, label: 'Own image' },
                  ].map((tool) => {
                    const active = activeTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => {
                          if (tool.id === 'preset') {
                            setPresetPickerPage(pageConfig.id);
                          } else {
                            setActiveBackgroundTool(pageConfig.id, tool.id);
                          }
                        }}
                        className={cn(
                          'min-h-11 rounded-xl px-3 text-sm font-black transition',
                          active ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
                        )}
                      >
                        {tool.label}
                      </button>
                    );
                  })}
                </div>

                {activeTool === 'color' ? (
                  <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,280px)_1fr] xl:items-center">
                      <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                        <input
                          type="color"
                          value={setting.mode === 'color' && setting.color ? setting.color : '#f4f5f7'}
                          onChange={(event) => saveBackground(pageConfig.id, { mode: 'color', color: event.target.value })}
                          disabled={saving || uploading}
                          className="h-10 w-12 cursor-pointer rounded-lg border border-zinc-200 bg-transparent p-0 disabled:cursor-not-allowed"
                        />
                        <span className="text-sm font-black text-zinc-900">Custom color picker</span>
                      </label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                        {BACKGROUND_COLORS.map((color) => {
                          const active = setting.mode === 'color' && setting.color === color.value;
                          return (
                            <button
                              key={color.id}
                              type="button"
                              onClick={() => saveBackground(pageConfig.id, { mode: 'color', color: color.value })}
                              disabled={saving || uploading}
                              className={cn(
                                'flex min-h-14 items-center gap-3 rounded-2xl border bg-white px-3 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60',
                                active ? 'border-zinc-900 ring-2 ring-zinc-900/10' : 'border-zinc-200',
                              )}
                            >
                              <span className="h-8 w-8 shrink-0 rounded-xl border border-white shadow-sm" style={{ backgroundColor: color.value }} />
                              <span className="text-xs font-black leading-4 text-zinc-800">{color.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeTool === 'custom' ? (
                  <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="grid gap-3">
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-sm font-black text-zinc-600 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700">
                        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                        Upload image to Firebase
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={saving || uploading}
                          onChange={(event) => uploadCustomBackground(pageConfig.id, event)}
                        />
                      </label>

                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input
                          type="url"
                          value={customUrl}
                          onChange={(event) => updateCustomUrl(pageConfig.id, event.target.value)}
                          placeholder="Paste an image URL"
                          className="min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:ring-2 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => saveBackground(pageConfig.id, { mode: 'custom', url: customUrl, overlay })}
                          disabled={saving || uploading || !customUrl.trim()}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Save URL
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Current background</p>
                      <p className="mt-1 text-sm font-black text-zinc-900">
                        {setting.mode === 'color' ? 'Color background' : selectedPreset?.label || (setting.mode === 'custom' ? 'Own image' : 'Default')}
                      </p>
                    </div>
                    <div className="flex rounded-2xl border border-zinc-200 bg-zinc-50 p-1">
                      {[
                        { id: 'clear' as const, label: 'Clear' },
                        { id: 'blur' as const, label: 'Blurry' },
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => saveOverlay(pageConfig.id, option.id)}
                          disabled={!canUseOverlay || saving || uploading}
                          className={cn(
                            'rounded-xl px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40',
                            overlay === option.id && canUseOverlay ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900',
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Dialog open={presetPickerPage === pageConfig.id} onOpenChange={(open) => setPresetPickerPage(open ? pageConfig.id : null)}>
                  <DialogContent className="max-h-[86vh] max-w-5xl overflow-y-auto rounded-3xl border-white/80 bg-white p-6">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black text-zinc-900">Choose an image preset</DialogTitle>
                      <DialogDescription>
                        Presets are included in the app and save as stable image URLs. They are grouped by style.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-7">
                      {BACKGROUND_CATEGORIES.map((category) => {
                        const presets = BACKGROUND_PRESETS.filter((preset) => preset.category === category);
                        return (
                          <section key={category}>
                            <h4 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{category}</h4>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {presets.map((preset) => {
                                const active = setting.mode === 'preset' && setting.url === preset.url;
                                return (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => {
                                      saveBackground(pageConfig.id, {
                                        mode: 'preset',
                                        presetId: preset.id,
                                        url: preset.url,
                                        overlay,
                                      });
                                      setPresetPickerPage(null);
                                    }}
                                    className={cn(
                                      'overflow-hidden rounded-2xl border bg-white text-left transition hover:-translate-y-0.5',
                                      active ? 'border-zinc-900 ring-2 ring-zinc-900/10' : 'border-zinc-200',
                                    )}
                                  >
                                    <span
                                      className="block h-44 bg-cover bg-center"
                                      style={{ backgroundImage: `url("${preset.url}")` }}
                                    />
                                    <span className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-black text-zinc-900">
                                      {preset.label}
                                      {active ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : null}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            );
          })}
        </div>
      </section>

      <section className={sectionClass}>
        <div className="flex items-center gap-3">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl text-zinc-700', isUniversityPortal ? 'border border-white/70 bg-white/72 shadow-[0_10px_24px_rgba(15,23,42,0.04)]' : 'bg-zinc-100')}>
            <School size={20} />
          </div>
          <div>
            <p className="text-sm font-black text-zinc-900">Theme changes only reload color tokens.</p>
            <p className="text-sm font-medium text-zinc-500">
              Layout, spacing, saved school work, and study data are left untouched.
            </p>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className={cn(isUniversityPortal ? 'rounded-[1.6rem] border border-white/70 bg-white/72 p-5 shadow-[0_14px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl' : 'rounded-2xl border border-zinc-200 bg-white p-5')}>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">App info</p>
            <h2 className="mt-1 text-xl font-black text-zinc-900">EducationRev University</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className={innerPanelClass}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Version</p>
                <p className="mt-2 text-sm font-black text-zinc-900">{appVersion}</p>
              </div>
              <div className={innerPanelClass}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Edition</p>
                <p className="mt-2 text-sm font-black text-zinc-900">University Portal</p>
              </div>
            </div>
            <div className={cn('mt-4', innerPanelClass)}>
              <p className="text-sm font-black text-zinc-900">EducationRev</p>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">Copyright © 2026 EducationRev. All rights reserved.</p>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">University edition for student workflow, study systems, and academic support.</p>
            </div>
          </div>

          <div className={cn(isUniversityPortal ? 'rounded-[1.6rem] border border-red-200/70 bg-white/72 p-5 shadow-[0_14px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl' : 'rounded-2xl border border-red-100 bg-red-50/60 p-5')}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-red-400">Account deletion</p>
            <h2 className="mt-1 text-xl font-black text-zinc-900">Delete account</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">
              Deleting your account removes your active EduRev profile and study data from the live app. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
            <label htmlFor="delete-reason" className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
              Reason for deletion
            </label>
            <select
              id="delete-reason"
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:ring-2 focus:ring-red-500"
            >
              {ACCOUNT_DELETION_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>This cannot be undone.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeletingAccount}
            className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-red-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-red-100 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
          >
            {isDeletingAccount ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Delete account'}
          </button>
        </div>
          </div>
        </div>
      </section>
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md rounded-3xl border-white/80 bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-zinc-900">Delete account?</DialogTitle>
            <DialogDescription className="text-sm font-medium leading-6 text-zinc-500">
              Are you sure you want to delete your account? This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeletingAccount}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              No, go back
            </button>
            <button
              type="button"
              onClick={async () => {
                setShowDeleteConfirm(false);
                await requestAccountDeletion();
              }}
              disabled={isDeletingAccount}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {isDeletingAccount ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Yes, delete'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
