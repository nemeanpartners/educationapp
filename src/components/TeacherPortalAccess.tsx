import { useEffect, useState } from 'react';
import {
  browserLocalPersistence,
  AuthProvider,
  setPersistence,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from '@/lib/portal-firestore';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CheckCheck,
  ClipboardList,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageSquare,
  Settings2,
  Reply,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  UserRound,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db, googleProvider, microsoftProvider } from '../firebase';
import { cn } from '../lib/utils';
import { bindNativeGoogleSignInBridge, isNativeIosGoogleWrapper, requestNativeGoogleSignIn } from '../lib/native-ios-google-auth';
import {
  normalizeTeacherTicket,
  flattenTeacherProfiles,
  readLocalTeacherTickets,
  normalizeTeacherClass,
  normalizeTeacherProfiles,
  readLocalTeacherProfiles,
  TeacherTicket,
  TeacherClass,
  TeacherProfile,
  teacherClassColours,
  writeLocalTeacherProfile,
  writeLocalTeacherTickets,
} from '../lib/teacher-tickets';

interface TeacherPortalAccessProps {
  user: User | null;
}

const teacherShellClass = 'rounded-[30px] border border-white/70 bg-white/68 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-2xl';
const teacherCardClass = 'rounded-[26px] border border-white/75 bg-white/82 shadow-sm backdrop-blur-xl';
const teacherLabelClass = 'text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400';
const teacherSectionTitleClass = 'mt-2 text-[2rem] font-black tracking-tight text-zinc-950';

function TeacherLoginPanel() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  }, []);

  useEffect(() => bindNativeGoogleSignInBridge(auth, {
    onSuccess: () => {
      setIsLoggingIn(false);
      setAuthError('');
    },
    onError: (message) => {
      setIsLoggingIn(false);
      setAuthError(message);
    },
  }), []);

  const handleLogin = async (provider: AuthProvider) => {
    setIsLoggingIn(true);
    setAuthError('');

    try {
      if (provider === googleProvider && isNativeIosGoogleWrapper()) {
        requestNativeGoogleSignIn();
        return;
      }
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setAuthError(error?.message || 'Teacher sign-in failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const authErrorHint = authError.includes('auth/operation-not-allowed')
    ? 'Microsoft login still needs to be enabled in Firebase Authentication with a Microsoft Entra client ID and client secret.'
    : authError;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-8 lg:grid-cols-[1fr_440px] lg:items-center">
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600 shadow-lg shadow-purple-950/30">
              <GraduationCap size={26} />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-purple-200">EduRev AI</p>
              <h1 className="text-3xl font-black tracking-tight">Teacher Portal</h1>
            </div>
          </div>

          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-purple-300">Ticket command centre</p>
            <h2 className="mt-5 text-5xl font-black tracking-tight sm:text-6xl">
              Reply to student requests from one focused inbox.
            </h2>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
              Teachers sign in here to view tickets sent from the student portal, reply directly, and close conversations when a request is resolved.
            </p>
          </div>

          <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
            {[
              { label: 'Live ticket feed', icon: Inbox },
              { label: 'Teacher replies', icon: Reply },
              { label: 'Closed requests', icon: CheckCheck },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <Icon className="h-6 w-6 text-purple-300" />
                  <p className="mt-4 text-sm font-black text-white">{item.label}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-white p-8 text-zinc-950 shadow-2xl shadow-black/30">
          <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600 text-white">
            <ShieldCheck size={28} />
          </div>
          <h2 className="text-3xl font-black tracking-tight">Teacher sign in</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">
            Use a school Google or Microsoft account to open the teacher ticket portal.
          </p>

          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={() => handleLogin(googleProvider)}
              disabled={isLoggingIn}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
              {isLoggingIn ? 'Signing in...' : 'Continue with Google'}
            </button>
            <button
              type="button"
              onClick={() => handleLogin(microsoftProvider)}
              disabled={isLoggingIn}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" className="h-5 w-5" alt="Microsoft" />
              {isLoggingIn ? 'Signing in...' : 'Continue with Microsoft'}
            </button>
          </div>

          {authError ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold leading-6 text-rose-700">
              {authErrorHint}
            </div>
          ) : null}

          <div className="mt-8 flex items-center gap-3 rounded-3xl bg-zinc-50 p-4">
            <LogIn className="h-5 w-5 text-purple-600" />
            <p className="text-xs font-bold leading-5 text-zinc-500">
              This portal is separate from the student portal so teachers land directly in the ticket inbox.
            </p>
          </div>

          <Link
            to="/auth"
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 text-sm font-black text-zinc-600 transition hover:bg-zinc-50"
          >
            <GraduationCap size={17} />
            Back to Student Portal Login
          </Link>
        </section>
      </div>
    </main>
  );
}

function statusStyles(status: TeacherTicket['status']) {
  if (status === 'open') return 'bg-amber-100 text-amber-700';
  if (status === 'replied') return 'bg-emerald-100 text-emerald-700';
  return 'bg-zinc-200 text-zinc-600';
}

function formatTicketDate(date: string) {
  return new Date(date).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function classSeed(value: string) {
  return value.split('').reduce((total, char, index) => total + char.charCodeAt(0) * (index + 1), 0);
}

interface PlaceholderStudentInsight {
  id: string;
  studentNumber: string;
  name: string;
  average: string;
  attendance: string;
  focus: string;
  wellbeing: string;
  trend: string;
  lastCheckIn: string;
  overdueAssignments: string[];
  supportAction: string;
}

interface PlaceholderAssessmentTracker {
  id: string;
  title: string;
  type: 'Assignment' | 'Exam' | 'Quiz';
  dueLabel: string;
  submittedDrafts: number;
  pendingDrafts: number;
  toFollowUp: Array<{
    studentId: string;
    studentNumber: string;
    studentName: string;
    status: string;
  }>;
}

function buildPlaceholderStudents(classItem: TeacherClass, teacherName: string) {
  const firstNames = ['Ava', 'Mia', 'Noah', 'Lucas', 'Ruby', 'Leo', 'Isla', 'Ethan', 'Sophie', 'Aria'];
  const lastNames = ['Chen', 'Singh', 'Walker', 'Nguyen', 'Patel', 'Johnson', 'Kim', 'Taylor', 'Wright', 'Lopez'];
  const seed = classSeed(classItem.id || classItem.subject || teacherName);

  return Array.from({ length: 20 }, (_, index): PlaceholderStudentInsight => {
    const firstName = firstNames[(seed + index * 3) % firstNames.length];
    const lastName = lastNames[(seed + index * 5) % lastNames.length];
    const overdueCount = (seed + index) % 4;
    return {
      id: `${classItem.id}-student-${index + 1}`,
      studentNumber: `S${String(1001 + ((seed + index * 17) % 8998))}`,
      name: `${firstName} ${lastName}`,
      average: `${78 + ((seed + index * 7) % 18)}%`,
      attendance: `${89 + ((seed + index * 4) % 10)}%`,
      focus: ['On track', 'Needs feedback', 'Extension ready'][(seed + index) % 3],
      wellbeing: ['Settled in class', 'Needs check-in', 'Quiet but engaged'][(seed + index * 2) % 3],
      trend: ['Improving this fortnight', 'Steady across tasks', 'Needs intervention on drafts'][(seed + index * 4) % 3],
      lastCheckIn: `${1 + ((seed + index) % 5)} day${(seed + index) % 5 === 0 ? '' : 's'} ago`,
      overdueAssignments: Array.from({ length: overdueCount }, (_, overdueIndex) => (
        `${classItem.subject} task ${overdueIndex + 1 + ((index + seed) % 3)}`
      )),
      supportAction: overdueCount > 1
        ? 'Priority follow-up'
        : overdueCount === 1
          ? 'Send reminder'
          : 'No immediate follow-up',
    };
  });
}

function buildPlaceholderAssignments(classItem: TeacherClass, students: PlaceholderStudentInsight[]) {
  const taskSet = [
    'Draft response',
    'Checkpoint quiz',
    'Practical reflection',
    'Source analysis',
    'Problem set',
    'Revision quiz',
  ];

  return Array.from({ length: 3 }, (_, index) => ({
    id: `${classItem.id}-assignment-${index + 1}`,
    title: `${classItem.subject} ${taskSet[(classSeed(classItem.subject) + index) % taskSet.length]}`,
    studentName: students[(index + classSeed(classItem.room || classItem.subject)) % students.length]?.name || 'Student',
    daysLate: `${index + 1} day${index === 0 ? '' : 's'} overdue`,
    priority: index === 0 ? 'High priority' : index === 1 ? 'Follow up this week' : 'Reminder sent',
  }));
}

function buildPlaceholderQcaa(classItem: TeacherClass) {
  const units = [
    'QCAA checkpoint quiz',
    'Exam technique sprint',
    'IA readiness review',
  ];

  return units.map((title, index) => ({
    id: `${classItem.id}-qcaa-${index + 1}`,
    title: `${classItem.subject} ${title}`,
    status: index === 0 ? 'Ready to publish' : index === 1 ? 'Needs question review' : 'Scheduled for next lesson',
    completion: `${58 + ((classSeed(classItem.subject) + index * 11) % 35)}% completion`,
  }));
}

function buildPlaceholderAssessments(classItem: TeacherClass, students: PlaceholderStudentInsight[]): PlaceholderAssessmentTracker[] {
  const assessmentTitles = [
    { suffix: 'Analytical assignment', type: 'Assignment' as const, dueLabel: 'Draft due next Tuesday' },
    { suffix: 'Unit exam', type: 'Exam' as const, dueLabel: 'Exam week in 9 days' },
    { suffix: 'Skills checkpoint', type: 'Quiz' as const, dueLabel: 'Quiz opens Friday' },
  ];

  return assessmentTitles.map((item, index) => {
    const seededStudents = students
      .filter((student, studentIndex) => (studentIndex + classSeed(classItem.subject) + index) % 3 !== 0)
      .slice(0, 6)
      .map((student, studentIndex) => ({
        studentId: student.id,
        studentNumber: student.studentNumber,
        studentName: student.name,
        status: index === 0
          ? (studentIndex % 2 === 0 ? 'Draft missing' : 'Needs draft feedback')
          : index === 1
            ? (studentIndex % 2 === 0 ? 'Revision plan missing' : 'Needs teacher check-in')
            : 'Quiz not started',
      }));

    return {
      id: `${classItem.id}-assessment-${index + 1}`,
      title: `${classItem.subject} ${item.suffix}`,
      type: item.type,
      dueLabel: item.dueLabel,
      submittedDrafts: students.length - seededStudents.length,
      pendingDrafts: seededStudents.length,
      toFollowUp: seededStudents,
    };
  });
}

function buildTeacherMeetings(classItems: TeacherClass[]) {
  const classes = classItems.length > 0 ? classItems : [{
    id: 'placeholder-class',
    subject: 'General teaching',
    room: 'Staff room',
    nextClass: 'Wednesday 3:15 PM',
  } as TeacherClass];

  return classes.slice(0, 3).map((classItem, index) => ({
    id: `${classItem.id}-meeting-${index + 1}`,
    title: `${classItem.subject} staff meeting`,
    time: index === 0 ? 'Monday 3:30 PM' : index === 1 ? 'Wednesday 7:45 AM' : 'Friday 2:15 PM',
    location: index === 0 ? 'Curriculum office' : index === 1 ? 'Learning hub' : classItem.room || 'Staff room',
    agenda: index === 0
      ? `Review ${classItem.subject} assessments and identify students needing follow-up.`
      : index === 1
        ? `Check draft release timing and moderation notes for ${classItem.subject}.`
        : `Confirm exam prep, assignment release, and support priorities for ${classItem.subject}.`,
  }));
}

function TeacherTicketPortal({ user }: { user: User }) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TeacherTicket[]>([]);
  const [teacherProfiles, setTeacherProfiles] = useState<TeacherProfile[]>([]);
  const [teacherName, setTeacherName] = useState(user.displayName || '');
  const [setupClasses, setSetupClasses] = useState<TeacherClass[]>([]);
  const [portalView, setPortalView] = useState<'dashboard' | 'inbox' | 'profile' | 'settings' | 'meetings'>('dashboard');
  const [selectedDashboardClassId, setSelectedDashboardClassId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedClassFilter, setSelectedClassFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | TeacherTicket['status']>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [setupMessage, setSetupMessage] = useState('');
  const [syncState, setSyncState] = useState<'loading' | 'live' | 'local'>('loading');

  useEffect(() => {
    const ticketsQuery = query(collection(db, 'teacherTickets'), orderBy('sentAt', 'desc'));

    const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      const loadedTickets = snapshot.docs.map((item) => normalizeTeacherTicket(item.id, item.data()));
      setTickets(loadedTickets);
      setSelectedTicketId((currentId) => {
        if (currentId && loadedTickets.some((ticket) => ticket.id === currentId)) return currentId;
        return loadedTickets[0]?.id || null;
      });
      setSyncState('live');
    }, (error) => {
      console.error('Could not load teacher tickets from Firestore:', error);
      const localTickets = readLocalTeacherTickets();
      setTickets(localTickets);
      setSelectedTicketId(localTickets[0]?.id || null);
      setSyncState('local');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const profilesQuery = query(collection(db, 'teacherProfiles'));
    const unsubscribe = onSnapshot(profilesQuery, (snapshot) => {
      const profiles = normalizeTeacherProfiles(snapshot.docs.map((profileDoc) => ({
        id: profileDoc.id,
        data: profileDoc.data(),
      })));
      setTeacherProfiles(profiles);

      const myProfile = profiles.find((profile) => profile.teacherId === user.uid);
      if (myProfile) {
        setTeacherName(myProfile.teacherName);
        setSetupClasses(myProfile.classes.length > 0 ? myProfile.classes : [{
          id: `${user.uid}-class-1`,
          teacherId: user.uid,
          teacher: myProfile.teacherName,
          subject: '',
          room: '',
          nextClass: '',
          colour: teacherClassColours[0],
        }]);
      } else {
        setSetupClasses([{
          id: `${user.uid}-class-1`,
          teacherId: user.uid,
          teacher: user.displayName || 'Teacher',
          subject: '',
          room: '',
          nextClass: '',
          colour: teacherClassColours[0],
        }]);
      }
    }, (error) => {
      console.error('Could not load teacher setup profiles:', error);
      const profiles = readLocalTeacherProfiles();
      setTeacherProfiles(profiles);
      const myProfile = profiles.find((profile) => profile.teacherId === user.uid);
      if (myProfile) {
        setTeacherName(myProfile.teacherName);
        setSetupClasses(myProfile.classes);
      }
    });

    return () => unsubscribe();
  }, [user.displayName, user.uid]);

  const configuredClasses = useMemo(() => flattenTeacherProfiles(teacherProfiles), [teacherProfiles]);
  const teacherDashboardClasses = useMemo(() => {
    const liveClasses = configuredClasses.filter((classItem) => classItem.teacherId === user.uid && classItem.subject.trim());
    if (liveClasses.length > 0) return liveClasses;
    return setupClasses.filter((classItem) => classItem.subject.trim());
  }, [configuredClasses, setupClasses, user.uid]);
  const teacherMeetings = useMemo(() => buildTeacherMeetings(teacherDashboardClasses), [teacherDashboardClasses]);
  const classFilters = useMemo(() => ['All', ...Array.from(new Set(configuredClasses.map((classItem) => classItem.subject)))], [configuredClasses]);
  const teacherClassPages = useMemo(() => teacherDashboardClasses.map((classItem, index) => {
    const students = buildPlaceholderStudents(classItem, teacherName || user.displayName || 'Teacher');
    const assignments = buildPlaceholderAssignments(classItem, students);
    const classTickets = tickets.filter((ticket) => ticket.classSubject === classItem.subject);
    const qcaa = buildPlaceholderQcaa(classItem);
    const assessments = buildPlaceholderAssessments(classItem, students);

    return {
      classItem,
      students,
      assignments,
      qcaa,
      assessments,
      ticketInquiries: classTickets.length > 0
        ? classTickets.slice(0, 4)
        : [{
          id: `${classItem.id}-placeholder-ticket-1`,
          studentName: students[0]?.name || 'Student',
          subject: `${classItem.subject} support check-in`,
          message: `Placeholder inquiry for ${classItem.subject}. Students can ask for help from the student portal and the request will appear here.`,
          status: 'open' as const,
          sentAt: new Date().toISOString(),
        }],
      metrics: {
        students: students.length,
        overdueAssignments: assignments.length,
        openTickets: classTickets.filter((ticket) => ticket.status !== 'closed').length,
        nextAction: index % 2 === 0 ? 'Publish QCAA revision quiz' : 'Review overdue worklist',
      },
    };
  }), [teacherDashboardClasses, teacherName, tickets, user.displayName]);
  const selectedClassPage = teacherClassPages.find((classPage) => classPage.classItem.id === selectedDashboardClassId) || null;
  const selectedStudent = selectedClassPage?.students.find((student) => student.id === selectedStudentId) || selectedClassPage?.students[0] || null;
  useEffect(() => {
    setSelectedDashboardClassId((currentId) => (
      currentId && teacherClassPages.some((classPage) => classPage.classItem.id === currentId)
        ? currentId
        : null
    ));
  }, [teacherClassPages]);
  useEffect(() => {
    setSelectedStudentId((currentId) => (
      currentId && selectedClassPage?.students.some((student) => student.id === currentId)
        ? currentId
        : selectedClassPage?.students[0]?.id || null
    ));
  }, [selectedClassPage]);
  const filteredTickets = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesClass = selectedClassFilter === 'All' || ticket.classSubject === selectedClassFilter;
      const matchesStatus = selectedStatusFilter === 'all' || ticket.status === selectedStatusFilter;
      const matchesSearch = !searchText ||
        ticket.studentName.toLowerCase().includes(searchText) ||
        ticket.studentEmail.toLowerCase().includes(searchText) ||
        ticket.subject.toLowerCase().includes(searchText) ||
        ticket.message.toLowerCase().includes(searchText) ||
        ticket.classSubject.toLowerCase().includes(searchText) ||
        ticket.teacher.toLowerCase().includes(searchText);

      return matchesClass && matchesStatus && matchesSearch;
    });
  }, [search, selectedClassFilter, selectedStatusFilter, tickets]);

  const selectedTicket = filteredTickets.find((ticket) => ticket.id === selectedTicketId) || filteredTickets[0] || null;
  const openCount = tickets.filter((ticket) => ticket.status === 'open').length;
  const repliedCount = tickets.filter((ticket) => ticket.status === 'replied').length;
  const closedCount = tickets.filter((ticket) => ticket.status === 'closed').length;
  const myConfiguredClassCount = setupClasses.filter((classItem) => classItem.subject.trim()).length;

  const ticketsByClass = useMemo(() => (
    filteredTickets.reduce<Record<string, TeacherTicket[]>>((groups, ticket) => {
      const key = ticket.classSubject || 'General';
      groups[key] = groups[key] || [];
      groups[key].push(ticket);
      return groups;
    }, {})
  ), [filteredTickets]);

  const updateLocalTicket = (updatedTicket: TeacherTicket) => {
    setTickets((currentTickets) => currentTickets.map((ticket) => ticket.id === updatedTicket.id ? updatedTicket : ticket));
    const storedTickets = readLocalTeacherTickets();
    const nextStoredTickets = storedTickets.some((ticket) => ticket.id === updatedTicket.id)
      ? storedTickets.map((ticket) => ticket.id === updatedTicket.id ? updatedTicket : ticket)
      : [updatedTicket, ...storedTickets];
    writeLocalTeacherTickets(nextStoredTickets.slice(0, 100));
  };

  const saveTicketUpdate = async (updatedTicket: TeacherTicket, successMessage: string) => {
    updateLocalTicket(updatedTicket);
    setStatusMessage(successMessage);

    try {
      await updateDoc(doc(db, 'teacherTickets', updatedTicket.id), {
        status: updatedTicket.status,
        replies: updatedTicket.replies,
        updatedAt: serverTimestamp(),
      });
      setSyncState('live');
    } catch (error) {
      console.error('Could not sync teacher ticket update:', error);
      setSyncState('local');
      setStatusMessage(`${successMessage} Firestore sync failed, so the change is saved locally on this device.`);
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !replyDraft.trim() || selectedTicket.status === 'closed') return;

    const teacherName = user.displayName || user.email || selectedTicket.teacher || 'Teacher';
    const updatedTicket: TeacherTicket = {
      ...selectedTicket,
      status: 'replied',
      replies: [
        ...selectedTicket.replies,
        {
          message: replyDraft.trim(),
          teacherName,
          repliedAt: new Date().toISOString(),
          senderRole: 'teacher',
          senderName: teacherName,
        },
      ],
    };

    setReplyDraft('');
    await saveTicketUpdate(updatedTicket, 'Reply sent.');
  };

  const closeTicket = async () => {
    if (!selectedTicket || selectedTicket.status === 'closed') return;
    await saveTicketUpdate({ ...selectedTicket, status: 'closed' }, 'Ticket closed.');
  };

  const updateSetupClass = (id: string, field: keyof Pick<TeacherClass, 'subject' | 'room' | 'nextClass'>, value: string) => {
    setSetupClasses((classes) => classes.map((classItem) => (
      classItem.id === id ? { ...classItem, [field]: value } : classItem
    )));
  };

  const addSetupClass = () => {
    setSetupClasses((classes) => [
      ...classes,
      {
        id: `${user.uid}-class-${Date.now()}`,
        teacherId: user.uid,
        teacher: teacherName || user.displayName || 'Teacher',
        subject: '',
        room: '',
        nextClass: '',
        colour: teacherClassColours[classes.length % teacherClassColours.length],
      },
    ]);
  };

  const removeSetupClass = (id: string) => {
    setSetupClasses((classes) => classes.length > 1 ? classes.filter((classItem) => classItem.id !== id) : classes);
  };

  const saveTeacherSetup = async () => {
    const cleanName = teacherName.trim() || user.displayName || user.email || 'Teacher';
    const cleanClasses = setupClasses
      .map((classItem, index) => normalizeTeacherClass({
        ...classItem,
        teacher: cleanName,
        subject: classItem.subject.trim(),
        room: classItem.room.trim(),
        nextClass: classItem.nextClass.trim(),
        colour: classItem.colour || teacherClassColours[index % teacherClassColours.length],
      }, user.uid, cleanName, index))
      .filter((classItem) => classItem.subject);

    const profile: TeacherProfile = {
      teacherId: user.uid,
      teacherName: cleanName,
      teacherEmail: user.email || '',
      classes: cleanClasses,
    };

    writeLocalTeacherProfile(profile);
    setTeacherProfiles((profiles) => profiles.some((item) => item.teacherId === profile.teacherId)
      ? profiles.map((item) => item.teacherId === profile.teacherId ? profile : item)
      : [profile, ...profiles]);
    setSetupClasses(cleanClasses.length > 0 ? cleanClasses : setupClasses);
    setSetupMessage('Teacher setup saved.');

    try {
      await setDoc(doc(db, 'teacherProfiles', user.uid), {
        teacherId: profile.teacherId,
        teacherName: profile.teacherName,
        teacherEmail: profile.teacherEmail,
        classes: profile.classes,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSyncState('live');
    } catch (error) {
      console.error('Could not sync teacher setup:', error);
      setSyncState('local');
      setSetupMessage('Teacher setup saved locally. Firestore sync failed.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/auth');
  };

  return (
    <main className="flex h-screen overflow-hidden bg-[linear-gradient(180deg,_#f7f8fc_0%,_#eef2ff_52%,_#f8fafc_100%)] text-zinc-950">
      <aside className="hidden w-80 shrink-0 flex-col border-r border-white/70 bg-white/62 backdrop-blur-2xl lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-zinc-100/80 px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-100">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-lg font-black tracking-tight">EduRev AI</p>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-purple-600">Teacher Portal</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className={cn(teacherShellClass, 'mb-5 p-4')}>
            <p className={cn(teacherLabelClass, 'mb-3 px-1')}>Portal views</p>
            <div className="space-y-2">
              {[
                { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
                { id: 'inbox' as const, label: 'Ticket inbox', icon: Inbox },
                { id: 'profile' as const, label: 'Profile', icon: UserRound },
                { id: 'settings' as const, label: 'Settings', icon: Settings2 },
                { id: 'meetings' as const, label: 'Staff meetings', icon: CalendarDays },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPortalView(item.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition',
                      portalView === item.id
                        ? 'bg-zinc-950 text-white shadow-lg shadow-zinc-200'
                        : 'text-zinc-600 hover:bg-white hover:text-zinc-950',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={cn(teacherShellClass, 'mb-5 p-4')}>
          <p className={cn(teacherLabelClass, 'mb-3 px-1')}>Classes</p>
          <div className="space-y-2">
            {classFilters.map((className) => {
              const classCount = className === 'All'
                ? tickets.length
                : tickets.filter((ticket) => ticket.classSubject === className).length;
              return (
                <button
                  key={className}
                  type="button"
                  onClick={() => {
                    setPortalView('inbox');
                    setSelectedClassFilter(className);
                    setSelectedTicketId(null);
                    setStatusMessage('');
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-black transition',
                    selectedClassFilter === className
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-100'
                      : 'text-zinc-600 hover:bg-white hover:text-zinc-950',
                  )}
                >
                  <span>{className}</span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px]',
                    selectedClassFilter === className ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500',
                  )}>
                    {classCount}
                  </span>
                </button>
              );
            })}
          </div>
          </div>

          <div className={cn(teacherShellClass, 'p-5')}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-purple-600">Teacher setup</p>
                <p className="mt-1 text-sm font-black text-zinc-950">{myConfiguredClassCount} visible classes</p>
              </div>
              <UserRound className="h-5 w-5 text-purple-600" />
            </div>

            <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">Teacher name</label>
            <input
              value={teacherName}
              onChange={(event) => setTeacherName(event.target.value)}
              placeholder="e.g. Ms Carter"
              className="mb-4 h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-800 outline-none focus:border-purple-300"
            />

            <div className="space-y-3">
              {setupClasses.map((classItem, index) => (
                <div key={classItem.id} className={cn(teacherCardClass, 'p-3')}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">Class {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeSetupClass(classItem.id)}
                      className="text-[11px] font-black uppercase tracking-[0.14em] text-rose-500 disabled:text-zinc-300"
                      disabled={setupClasses.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="space-y-2">
                    <input
                      value={classItem.subject}
                      onChange={(event) => updateSetupClass(classItem.id, 'subject', event.target.value)}
                      placeholder="Subject or class name"
                      className="h-10 w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 text-xs font-bold outline-none focus:border-purple-300"
                    />
                    <input
                      value={classItem.room}
                      onChange={(event) => updateSetupClass(classItem.id, 'room', event.target.value)}
                      placeholder="Room, e.g. Lab 2"
                      className="h-10 w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 text-xs font-bold outline-none focus:border-purple-300"
                    />
                    <input
                      value={classItem.nextClass}
                      onChange={(event) => updateSetupClass(classItem.id, 'nextClass', event.target.value)}
                      placeholder="Timetable slot, e.g. Monday 8:45 AM"
                      className="h-10 w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 text-xs font-bold outline-none focus:border-purple-300"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={addSetupClass}
                className="h-11 rounded-2xl border border-purple-200 bg-white text-xs font-black text-purple-700 hover:bg-purple-100"
              >
                Add class
              </button>
              <button
                type="button"
                onClick={saveTeacherSetup}
                className="h-11 rounded-2xl bg-purple-600 text-xs font-black text-white shadow-lg shadow-purple-100 hover:bg-purple-700"
              >
                Save setup
              </button>
            </div>
            {setupMessage ? (
              <p className="mt-3 text-xs font-bold leading-5 text-purple-700">{setupMessage}</p>
            ) : null}
          </div>

          <div className="mt-5 rounded-3xl bg-zinc-950 p-5 text-white">
            <Sparkles className="h-6 w-6 text-purple-300" />
            <p className="mt-4 text-sm font-black">Teacher workflow</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-zinc-400">
              Open tickets stay highlighted until a teacher reply is sent or the request is closed.
            </p>
          </div>
        </div>

        <div className="border-t border-zinc-100 p-5">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black text-zinc-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {portalView === 'dashboard' ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,_#f6f8ff_0%,_#eef2ff_52%,_#f8fafc_100%)] px-6 py-6 lg:px-8 lg:py-8">
            {selectedClassPage ? (
              <div className="mx-auto flex max-w-7xl flex-col gap-6">
                <div className={cn(teacherShellClass, 'p-7')}>
                  <button
                    type="button"
                    onClick={() => setSelectedDashboardClassId(null)}
                    className="mb-5 inline-flex items-center gap-2 rounded-2xl border border-white/60 bg-white/70 px-4 py-2 text-sm font-black text-zinc-700 shadow-sm backdrop-blur-xl transition hover:bg-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to dashboard
                  </button>
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className={teacherLabelClass}>Class page</p>
                      <h1 className="mt-3 text-[2.35rem] font-black tracking-tight text-zinc-950">{selectedClassPage.classItem.subject}</h1>
                      <p className="mt-2 text-sm font-semibold text-zinc-500">
                        {selectedClassPage.classItem.room || 'Room to be confirmed'} · {selectedClassPage.classItem.nextClass || 'Timetable slot pending'}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        { label: 'Students', value: selectedClassPage.metrics.students },
                        { label: 'Overdue', value: selectedClassPage.metrics.overdueAssignments },
                        { label: 'Open tickets', value: selectedClassPage.metrics.openTickets },
                      ].map((metric) => (
                        <div key={metric.label} className={cn(teacherCardClass, 'px-4 py-3')}>
                          <p className={teacherLabelClass}>{metric.label}</p>
                          <p className="mt-2 text-2xl font-black text-zinc-950">{metric.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                  <section className={cn(teacherShellClass, 'p-6')}>
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <p className={teacherLabelClass}>Class roster</p>
                        <h2 className={teacherSectionTitleClass}>Student list</h2>
                      </div>
                      <Users className="h-6 w-6 text-purple-500" />
                    </div>

                    <div className={cn(teacherCardClass, 'shadow-none')}>
                      <div className="grid grid-cols-[0.9fr_1.6fr_1fr_1fr_1.1fr] gap-3 border-b border-zinc-200/80 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">
                        <span>Student #</span>
                        <span>Name</span>
                        <span>Average</span>
                        <span>Attendance</span>
                        <span>Status</span>
                      </div>
                      <div className="max-h-[640px] overflow-y-auto">
                        {selectedClassPage.students.map((student) => {
                          const isSelected = selectedStudent?.id === student.id;
                          return (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => setSelectedStudentId(student.id)}
                              className={cn(
                                'grid w-full grid-cols-[0.9fr_1.6fr_1fr_1fr_1.1fr] gap-3 border-b border-zinc-100/80 px-4 py-3 text-left transition last:border-b-0',
                                isSelected ? 'bg-blue-50/80' : 'bg-transparent hover:bg-zinc-50/80',
                              )}
                            >
                              <span className="truncate text-sm font-black text-blue-600">{student.studentNumber}</span>
                              <span className="truncate text-sm font-black text-zinc-950">{student.name}</span>
                              <span className="text-sm font-semibold text-zinc-600">{student.average}</span>
                              <span className="text-sm font-semibold text-zinc-600">{student.attendance}</span>
                              <span className="text-sm font-semibold text-zinc-500">{student.focus}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  <div className="space-y-6">
                    {selectedStudent ? (
                      <section className={cn(teacherShellClass, 'p-6')}>
                        <div className="mb-5 flex items-start justify-between gap-3">
                          <div>
                            <p className={teacherLabelClass}>Student insights</p>
                            <h2 className={teacherSectionTitleClass}>{selectedStudent.name}</h2>
                            <p className="mt-1 text-sm font-semibold text-zinc-500">{selectedStudent.studentNumber}</p>
                          </div>
                          <div className="rounded-2xl bg-blue-50 px-3 py-2 text-right">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-500">Average</p>
                            <p className="text-base font-black text-blue-700">{selectedStudent.average}</p>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            { label: 'Attendance', value: selectedStudent.attendance },
                            { label: 'How they are going', value: selectedStudent.focus },
                            { label: 'Wellbeing', value: selectedStudent.wellbeing },
                            { label: 'Trend', value: selectedStudent.trend },
                            { label: 'Last check-in', value: selectedStudent.lastCheckIn },
                            { label: 'Action', value: selectedStudent.supportAction },
                          ].map((item) => (
                            <div key={item.label} className={cn(teacherCardClass, 'p-4')}>
                              <p className={teacherLabelClass}>{item.label}</p>
                              <p className="mt-2 text-sm font-black text-zinc-900">{item.value}</p>
                            </div>
                          ))}
                        </div>

                        <div className={cn(teacherCardClass, 'mt-5 p-4')}>
                          <p className={teacherLabelClass}>Overdue assignments</p>
                          {selectedStudent.overdueAssignments.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {selectedStudent.overdueAssignments.map((assignment) => (
                                <div key={assignment} className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50/90 px-3 py-2">
                                  <span className="text-sm font-semibold text-zinc-700">{assignment}</span>
                                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-600">Overdue</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-sm font-semibold text-emerald-600">No overdue assignments right now.</p>
                          )}
                        </div>
                      </section>
                    ) : null}

                    <section className={cn(teacherShellClass, 'p-6')}>
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                          <p className={teacherLabelClass}>QCAA</p>
                          <h2 className={teacherSectionTitleClass}>Quizzes and checkpoints</h2>
                        </div>
                        <BookOpen className="h-6 w-6 text-indigo-500" />
                      </div>
                      <div className="space-y-3">
                        {selectedClassPage.qcaa.map((item) => (
                          <article key={item.id} className="rounded-3xl border border-white/60 bg-white/75 p-4 shadow-sm backdrop-blur-xl">
                            <p className="text-sm font-black text-zinc-950">{item.title}</p>
                            <p className="mt-2 text-sm font-semibold text-zinc-500">{item.status}</p>
                            <div className="mt-3 rounded-2xl bg-zinc-50/80 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                              {item.completion}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>

                <section className={cn(teacherShellClass, 'p-6')}>
                  <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className={teacherLabelClass}>Assessments</p>
                      <h2 className={teacherSectionTitleClass}>Follow-up tracker</h2>
                      <p className="mt-2 text-sm font-semibold text-zinc-500">
                        Use this section to see exactly who still needs a draft, feedback, or revision follow-up across the class.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm font-black text-zinc-700 shadow-sm backdrop-blur-xl transition hover:bg-white"
                      >
                        <MessageSquare className="h-4 w-4 text-purple-500" />
                        Quick send follow-up
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-purple-200 transition hover:bg-purple-700"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Send all follow-up tickets
                      </button>
                    </div>
                  </div>

                  <div className={cn(teacherCardClass, 'mb-5 p-4')}>
                    <p className="text-xs font-bold leading-6 text-zinc-500">
                      Placeholder logic: the quick send action will later create a student-facing follow-up message and ticket for each listed student who still needs a draft, feedback, revision plan, or quiz completion.
                    </p>
                  </div>

                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className={teacherLabelClass}>Ticket inquiries</p>
                      <h2 className={teacherSectionTitleClass}>Student help requests for this class</h2>
                    </div>
                    <MessageSquare className="h-6 w-6 text-purple-500" />
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {selectedClassPage.ticketInquiries.map((ticket) => (
                      <article key={ticket.id} className="rounded-3xl border border-white/60 bg-white/75 p-5 shadow-sm backdrop-blur-xl">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-black text-zinc-950">{ticket.studentName}</p>
                            <p className="mt-1 text-sm font-semibold text-zinc-500">{ticket.subject}</p>
                          </div>
                          <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-black capitalize', statusStyles(ticket.status))}>
                            {ticket.status}
                          </span>
                        </div>
                        <p className="mt-4 text-sm font-semibold leading-6 text-zinc-600">{ticket.message}</p>
                        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{formatTicketDate(ticket.sentAt)}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className={cn(teacherShellClass, 'p-6')}>
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className={teacherLabelClass}>Assessments</p>
                      <h2 className="mt-2 text-[2.2rem] font-black tracking-tight text-zinc-950">Follow-up tracker</h2>
                    </div>
                    <ClipboardList className="h-6 w-6 text-amber-500" />
                  </div>

                  <div className="space-y-5">
                    {selectedClassPage.assessments.map((assessment) => (
                      <article key={assessment.id} className={cn(teacherCardClass, 'p-5')}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-[1.7rem] font-black leading-tight text-zinc-950">{assessment.title}</h3>
                              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-black text-sky-700">{assessment.type}</span>
                            </div>
                            <p className="mt-2 text-base font-semibold text-zinc-500">{assessment.dueLabel}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-[24px] bg-emerald-50 px-4 py-3 text-center">
                              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">Submitted</p>
                              <p className="mt-1 text-3xl font-black text-emerald-700">{assessment.submittedDrafts}</p>
                            </div>
                            <div className="rounded-[24px] bg-rose-50 px-4 py-3 text-center">
                              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-600">Follow up</p>
                              <p className="mt-1 text-3xl font-black text-rose-700">{assessment.pendingDrafts}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/70">
                          <div className="grid grid-cols-[0.9fr_1.4fr_1.8fr] gap-3 bg-zinc-50/90 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                            <span>Student #</span>
                            <span>Student</span>
                            <span>Status</span>
                          </div>
                          <div>
                            {assessment.toFollowUp.map((student) => (
                              <div key={`${assessment.id}-${student.studentId}`} className="grid grid-cols-[0.9fr_1.4fr_1.8fr] gap-3 border-t border-zinc-100/90 bg-white/80 px-4 py-3">
                                <span className="text-sm font-black text-sky-600">{student.studentNumber}</span>
                                <span className="text-sm font-black text-zinc-900">{student.studentName}</span>
                                <span className="text-sm font-semibold text-zinc-500">{student.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm font-black text-zinc-700 shadow-sm backdrop-blur-xl transition hover:bg-white"
                          >
                            <MessageSquare className="h-4 w-4 text-purple-500" />
                            Send tickets to listed students
                          </button>
                          <p className="flex items-center text-xs font-bold leading-5 text-zinc-500">
                            Placeholder: sends a follow-up message and ticket to every student in this tracker card.
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <div className="mx-auto flex max-w-7xl flex-col gap-6">
                <section className={cn(teacherShellClass, 'p-6 lg:p-8')}>
                  <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
                    <div className="max-w-4xl">
                      <p className={teacherLabelClass}>Teacher dashboard</p>
                      <h1 className="mt-4 max-w-5xl text-4xl font-black tracking-tight text-zinc-950 lg:text-5xl">
                        See every class, every ticket, and the next action in one place.
                      </h1>
                      <p className="mt-4 text-base font-semibold leading-7 text-zinc-600">
                        Each class opens into its own page with placeholder students, overdue work, ticket inquiries, and QCAA quiz planning.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 xl:self-end">
                      {[
                        {
                          label: 'Classes',
                          value: teacherClassPages.length,
                          tone: 'text-purple-700',
                          onClick: () => {
                            setPortalView('dashboard');
                            setSelectedDashboardClassId(null);
                          },
                        },
                        {
                          label: 'Open tickets',
                          value: openCount,
                          tone: 'text-amber-600',
                          onClick: () => {
                            setPortalView('inbox');
                            setSelectedClassFilter('All');
                            setSelectedStatusFilter('open');
                            setSelectedTicketId(null);
                          },
                        },
                        {
                          label: 'Replied',
                          value: repliedCount,
                          tone: 'text-emerald-600',
                          onClick: () => {
                            setPortalView('inbox');
                            setSelectedClassFilter('All');
                            setSelectedStatusFilter('replied');
                            setSelectedTicketId(null);
                          },
                        },
                      ].map((metric) => (
                        <button
                          key={metric.label}
                          type="button"
                          onClick={metric.onClick}
                          className={cn(teacherCardClass, 'flex min-h-[136px] flex-col justify-between px-4 py-4 text-center transition hover:-translate-y-0.5 hover:bg-white')}
                        >
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-400">{metric.label}</p>
                          <p className={cn('mt-4 text-4xl font-black leading-none', metric.tone)}>{metric.value}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {teacherClassPages.length > 0 ? (
                  <section className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
                    {teacherClassPages.map((classPage) => (
                      <button
                        key={classPage.classItem.id}
                        type="button"
                        onClick={() => setSelectedDashboardClassId(classPage.classItem.id)}
                        className={cn(teacherShellClass, 'group p-6 text-left transition hover:-translate-y-1 hover:bg-white/78')}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className={teacherLabelClass}>Class overview</p>
                            <h2 className="mt-3 text-2xl font-black text-zinc-950">{classPage.classItem.subject}</h2>
                            <p className="mt-2 text-sm font-semibold text-zinc-500">
                              {classPage.classItem.room || 'Room pending'} · {classPage.classItem.nextClass || 'Timetable slot pending'}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-purple-100 px-3 py-2 text-right">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-purple-500">Next action</p>
                            <p className="mt-1 text-xs font-black text-purple-700">{classPage.metrics.nextAction}</p>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-3 gap-3">
                          {[
                            { label: 'Students', value: classPage.metrics.students },
                            { label: 'Overdue', value: classPage.metrics.overdueAssignments },
                            { label: 'Tickets', value: classPage.metrics.openTickets },
                          ].map((metric) => (
                            <div key={metric.label} className={cn(teacherCardClass, 'px-3 py-3')}>
                              <p className={teacherLabelClass}>{metric.label}</p>
                              <p className="mt-2 text-xl font-black text-zinc-950">{metric.value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-5 grid gap-3">
                          <div className={cn(teacherCardClass, 'p-4')}>
                            <div className="mb-3 flex items-center justify-between">
                              <p className={teacherLabelClass}>Assessment follow-up</p>
                              <ClipboardList className="h-4 w-4 text-amber-500" />
                            </div>
                            <div className="space-y-2">
                              {classPage.assessments.slice(0, 3).map((assessment) => (
                                <div key={assessment.id} className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50/85 px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-zinc-900">{assessment.title}</p>
                                  </div>
                                  <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-500">
                                    {assessment.pendingDrafts} outstanding
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className={cn(teacherCardClass, 'p-4')}>
                            <div className="mb-3 flex items-center justify-between">
                              <p className={teacherLabelClass}>QCAA</p>
                              <BookOpen className="h-4 w-4 text-indigo-500" />
                            </div>
                            <div className="space-y-2">
                              {classPage.qcaa.slice(0, 2).map((item) => (
                                <div key={item.id} className="rounded-2xl bg-zinc-50/85 px-3 py-2">
                                  <p className="text-sm font-black text-zinc-900">{item.title}</p>
                                  <p className="mt-1 text-xs font-semibold text-zinc-500">{item.status}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </section>
                ) : (
                  <section className="rounded-[32px] border border-dashed border-white/60 bg-white/45 p-10 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
                    <LayoutDashboard className="mx-auto mb-4 h-12 w-12 text-purple-400" />
                    <h2 className="text-2xl font-black text-zinc-950">Add your classes in Teacher setup</h2>
                    <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-zinc-500">
                      Once classes are saved, this dashboard will populate separate class pages with students, ticket inquiries, overdue work, and QCAA quiz planning cards.
                    </p>
                  </section>
                )}
              </div>
            )}
          </div>
        ) : portalView === 'profile' ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,_#f7f9ff_0%,_#eef2ff_56%,_#f8fafc_100%)] px-6 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-6xl space-y-6">
              <section className={cn(teacherShellClass, 'p-6')}>
                <p className={teacherLabelClass}>Teacher profile</p>
                <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h1 className="text-4xl font-black tracking-tight text-zinc-950">{teacherName || user.displayName || 'Teacher'}</h1>
                    <p className="mt-2 text-sm font-semibold text-zinc-500">{user.email || 'Teacher email unavailable'}</p>
                  </div>
                  <div className={cn(teacherCardClass, 'px-5 py-4')}>
                    <p className={teacherLabelClass}>Auto-filled</p>
                    <p className="mt-2 text-sm font-black text-zinc-900">Connected to your teacher setup profile and classes.</p>
                  </div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <div className={cn(teacherShellClass, 'p-6')}>
                  <p className={teacherLabelClass}>Editable details</p>
                  <div className="mt-5 space-y-4">
                    <div>
                      <label className={cn(teacherLabelClass, 'mb-2 block')}>Teacher name</label>
                      <input
                        value={teacherName}
                        onChange={(event) => setTeacherName(event.target.value)}
                        className="h-12 w-full rounded-2xl border border-zinc-200 bg-white/90 px-4 text-sm font-bold text-zinc-900 outline-none focus:border-purple-300"
                      />
                    </div>
                    <div>
                      <label className={cn(teacherLabelClass, 'mb-2 block')}>Email</label>
                      <input
                        value={user.email || ''}
                        readOnly
                        className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-500 outline-none"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        { label: 'Visible classes', value: String(myConfiguredClassCount) },
                        { label: 'Open tickets', value: String(openCount) },
                        { label: 'Meetings this week', value: String(teacherMeetings.length) },
                      ].map((item) => (
                        <div key={item.label} className={cn(teacherCardClass, 'p-4')}>
                          <p className={teacherLabelClass}>{item.label}</p>
                          <p className="mt-2 text-2xl font-black text-zinc-950">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={saveTeacherSetup}
                      className="inline-flex h-12 items-center justify-center rounded-2xl bg-purple-600 px-5 text-sm font-black text-white shadow-lg shadow-purple-200 transition hover:bg-purple-700"
                    >
                      Save profile updates
                    </button>
                    {setupMessage ? <p className="text-sm font-bold text-purple-700">{setupMessage}</p> : null}
                  </div>
                </div>

                <div className={cn(teacherShellClass, 'p-6')}>
                  <p className={teacherLabelClass}>Current teaching load</p>
                  <div className="mt-5 space-y-3">
                    {teacherDashboardClasses.length > 0 ? teacherDashboardClasses.map((classItem) => (
                      <div key={classItem.id} className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
                        <p className="text-lg font-black text-zinc-950">{classItem.subject}</p>
                        <p className="mt-1 text-sm font-semibold text-zinc-500">{classItem.room || 'Room pending'} · {classItem.nextClass || 'Timetable slot pending'}</p>
                      </div>
                    )) : (
                      <div className="rounded-3xl border border-dashed border-zinc-200 bg-white/70 p-6 text-center">
                        <p className="text-sm font-semibold text-zinc-500">Add classes in teacher setup to populate your profile.</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : portalView === 'settings' ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,_#fbf7ff_0%,_#f5f7ff_48%,_#f8fafc_100%)] px-6 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-6xl space-y-6">
              <section className={cn(teacherShellClass, 'p-6')}>
                <p className={teacherLabelClass}>Teacher settings</p>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-zinc-950">Portal settings</h1>
                <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">
                  These settings are placeholders for teacher preferences. Your name and class setup below are editable now and save back to your teacher profile.
                </p>
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <div className={cn(teacherShellClass, 'p-6')}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className={teacherLabelClass}>Teacher setup</p>
                      <p className="mt-1 text-sm font-black text-zinc-950">{myConfiguredClassCount} visible classes</p>
                    </div>
                    <Settings2 className="h-5 w-5 text-purple-500" />
                  </div>

                  <label className={cn(teacherLabelClass, 'mb-2 block text-zinc-500')}>Teacher name</label>
                  <input
                    value={teacherName}
                    onChange={(event) => setTeacherName(event.target.value)}
                    placeholder="e.g. Ms Carter"
                    className="mb-4 h-11 w-full rounded-2xl border border-purple-100 bg-white px-3 text-sm font-bold text-zinc-800 outline-none focus:border-purple-300"
                  />

                  <div className="space-y-3">
                    {setupClasses.map((classItem, index) => (
                      <div key={classItem.id} className={cn(teacherCardClass, 'p-3')}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className={teacherLabelClass}>Class {index + 1}</p>
                          <button
                            type="button"
                            onClick={() => removeSetupClass(classItem.id)}
                            className="text-[11px] font-black uppercase tracking-[0.14em] text-rose-500 disabled:text-zinc-300"
                            disabled={setupClasses.length === 1}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="space-y-2">
                          <input
                            value={classItem.subject}
                            onChange={(event) => updateSetupClass(classItem.id, 'subject', event.target.value)}
                            placeholder="Subject or class name"
                            className="h-10 w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 text-xs font-bold outline-none focus:border-purple-300"
                          />
                          <input
                            value={classItem.room}
                            onChange={(event) => updateSetupClass(classItem.id, 'room', event.target.value)}
                            placeholder="Room, e.g. Lab 2"
                            className="h-10 w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 text-xs font-bold outline-none focus:border-purple-300"
                          />
                          <input
                            value={classItem.nextClass}
                            onChange={(event) => updateSetupClass(classItem.id, 'nextClass', event.target.value)}
                            placeholder="Timetable slot, e.g. Monday 8:45 AM"
                            className="h-10 w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 text-xs font-bold outline-none focus:border-purple-300"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={addSetupClass}
                      className="h-11 rounded-2xl border border-purple-200 bg-white text-xs font-black text-purple-700 hover:bg-purple-100"
                    >
                      Add class
                    </button>
                    <button
                      type="button"
                      onClick={saveTeacherSetup}
                      className="h-11 rounded-2xl bg-purple-600 text-xs font-black text-white shadow-lg shadow-purple-100 hover:bg-purple-700"
                    >
                      Save settings
                    </button>
                  </div>
                  {setupMessage ? <p className="mt-3 text-xs font-bold leading-5 text-purple-700">{setupMessage}</p> : null}
                </div>

                <div className="space-y-6">
                  <section className={cn(teacherShellClass, 'p-6')}>
                    <p className={teacherLabelClass}>Notification preferences</p>
                    <div className="mt-5 space-y-3">
                      {[
                        'Student follow-up reminders enabled',
                        'Daily teacher summary enabled',
                        'QCAA release checks enabled',
                      ].map((item) => (
                        <div key={item} className={cn(teacherCardClass, 'px-4 py-4')}>
                          <p className="text-sm font-black text-zinc-900">{item}</p>
                          <p className="mt-1 text-xs font-semibold text-zinc-500">Placeholder toggle for later wiring.</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className={cn(teacherShellClass, 'p-6')}>
                    <p className={teacherLabelClass}>Connected account</p>
                    <div className={cn(teacherCardClass, 'mt-5 p-4')}>
                      <p className="text-sm font-black text-zinc-900">{teacherName || user.displayName || 'Teacher'}</p>
                      <p className="mt-1 text-sm font-semibold text-zinc-500">{user.email || 'Teacher email unavailable'}</p>
                    </div>
                  </section>
                </div>
              </section>
            </div>
          </div>
        ) : portalView === 'meetings' ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,_#f3f8ff_0%,_#eef4ff_52%,_#f8fafc_100%)] px-6 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-6xl space-y-6">
              <section className={cn(teacherShellClass, 'p-6')}>
                <p className={teacherLabelClass}>Staff meetings</p>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-zinc-950">Meeting schedule and release checklist</h1>
                <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">
                  This page shows placeholder staff meeting times, the exams and assignments to release, and what teachers need to review before those releases.
                </p>
              </section>

              <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-4">
                  {teacherMeetings.map((meeting) => (
                    <article key={meeting.id} className={cn(teacherShellClass, 'p-6')}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xl font-black text-zinc-950">{meeting.title}</p>
                          <p className="mt-2 text-sm font-semibold text-zinc-500">{meeting.time} · {meeting.location}</p>
                        </div>
                        <CalendarDays className="h-5 w-5 text-sky-500" />
                      </div>
                      <p className="mt-4 text-sm font-semibold leading-6 text-zinc-600">{meeting.agenda}</p>
                    </article>
                  ))}
                </div>

                <div className="space-y-6">
                  <section className={cn(teacherShellClass, 'p-6')}>
                    <p className={teacherLabelClass}>Assignments to release</p>
                    <div className="mt-5 space-y-3">
                      {teacherDashboardClasses.slice(0, 3).map((classItem) => (
                        <div key={`${classItem.id}-release-assignment`} className={cn(teacherCardClass, 'p-4')}>
                          <p className="text-sm font-black text-zinc-900">{classItem.subject} analytical assignment</p>
                          <p className="mt-1 text-sm font-semibold text-zinc-500">Release after moderation meeting and class overview check.</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className={cn(teacherShellClass, 'p-6')}>
                    <p className={teacherLabelClass}>Exams to go over</p>
                    <div className="mt-5 space-y-3">
                      {teacherDashboardClasses.slice(0, 3).map((classItem) => (
                        <div key={`${classItem.id}-exam-review`} className={cn(teacherCardClass, 'p-4')}>
                          <p className="text-sm font-black text-zinc-900">{classItem.subject} unit exam</p>
                          <p className="mt-1 text-sm font-semibold text-zinc-500">Review wording, mark scheme, and student support list before release.</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </section>
            </div>
          </div>
        ) : (
          <>
            <header className="flex min-h-20 shrink-0 flex-col gap-4 border-b border-zinc-200 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest',
                    syncState === 'live' ? 'bg-emerald-100 text-emerald-700' : syncState === 'local' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-500',
                  )}>
                    {syncState === 'live' ? 'Live Firestore' : syncState === 'local' ? 'Local fallback' : 'Loading'}
                  </span>
                </div>
                <h1 className="text-3xl font-black tracking-tight">Student ticket inbox</h1>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:flex">
                {[
                  { label: 'Open', value: openCount, tone: 'bg-amber-50 text-amber-700' },
                  { label: 'Replied', value: repliedCount, tone: 'bg-emerald-50 text-emerald-700' },
                  { label: 'Closed', value: closedCount, tone: 'bg-zinc-100 text-zinc-700' },
                ].map((metric) => (
                  <div key={metric.label} className={cn('rounded-2xl px-4 py-3', metric.tone)}>
                    <p className="text-[10px] font-black uppercase tracking-widest">{metric.label}</p>
                    <p className="text-2xl font-black">{metric.value}</p>
                  </div>
                ))}
              </div>
            </header>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[430px_1fr]">
              <aside className="flex min-h-0 flex-col border-r border-zinc-200 bg-white">
                <div className="shrink-0 border-b border-zinc-100 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={selectedStatusFilter}
                      onChange={(event) => {
                        setSelectedStatusFilter(event.target.value as typeof selectedStatusFilter);
                        setSelectedTicketId(null);
                      }}
                      className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-700 outline-none focus:border-purple-300"
                    >
                      <option value="all">All statuses</option>
                      <option value="open">Open</option>
                      <option value="replied">Replied</option>
                      <option value="closed">Closed</option>
                    </select>
                    <select
                      value={selectedClassFilter}
                      onChange={(event) => {
                        setSelectedClassFilter(event.target.value);
                        setSelectedTicketId(null);
                      }}
                      className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-700 outline-none focus:border-purple-300 lg:hidden"
                    >
                      {classFilters.map((className) => (
                        <option key={className} value={className}>{className}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative mt-3">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search student, subject, class"
                      className="h-14 w-full rounded-2xl border border-zinc-200 bg-zinc-50 pl-12 pr-4 text-sm font-semibold outline-none placeholder:text-zinc-400 focus:border-purple-300 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  {filteredTickets.length > 0 ? (
                    <div className="space-y-6">
                      {(Object.entries(ticketsByClass) as [string, TeacherTicket[]][]).map(([className, classTickets]) => (
                        <section key={className}>
                          <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">{className}</h2>
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black text-zinc-500">{classTickets.length}</span>
                          </div>
                          <div className="space-y-2">
                            {classTickets.map((ticket) => {
                              const latestReply = ticket.replies[ticket.replies.length - 1];
                              const isSelected = selectedTicket?.id === ticket.id;
                              return (
                                <button
                                  key={ticket.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedTicketId(ticket.id);
                                    setStatusMessage('');
                                  }}
                                  className={cn(
                                    'w-full rounded-3xl border p-4 text-left transition',
                                    isSelected ? 'border-purple-300 bg-purple-50' : 'border-zinc-100 bg-white hover:border-zinc-200 hover:bg-zinc-50',
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-base font-black text-zinc-950">{ticket.studentName}</p>
                                      <p className="mt-0.5 truncate text-sm font-bold text-zinc-500">{ticket.subject}</p>
                                    </div>
                                    <span className="shrink-0 text-xs font-bold text-zinc-400">{formatTicketDate(ticket.sentAt)}</span>
                                  </div>
                                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-zinc-500">
                                    {latestReply
                                      ? `${latestReply.senderRole === 'teacher' ? 'You' : ticket.studentName}: ${latestReply.message}`
                                      : ticket.message}
                                  </p>
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-black text-zinc-500">{ticket.tag}</span>
                                    <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-black capitalize', statusStyles(ticket.status))}>
                                      {ticket.status}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
                      <Inbox className="mx-auto mb-4 h-10 w-10 text-zinc-300" />
                      <p className="text-lg font-black text-zinc-900">No tickets found</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-500">
                        Student tickets sent from the student portal will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </aside>

              <section className="hidden min-w-0 flex-col bg-zinc-50 lg:flex">
                {selectedTicket ? (
                  <>
                    <header className="flex min-h-24 shrink-0 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-8">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-black text-purple-700">{selectedTicket.classSubject}</span>
                          <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-black capitalize', statusStyles(selectedTicket.status))}>
                            {selectedTicket.status}
                          </span>
                        </div>
                        <h2 className="truncate text-2xl font-black text-zinc-950">{selectedTicket.studentName}</h2>
                        <p className="truncate text-sm font-semibold text-zinc-500">{selectedTicket.subject}</p>
                      </div>
                      <button
                        type="button"
                        onClick={closeTicket}
                        disabled={selectedTicket.status === 'closed'}
                        className="flex h-12 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-black text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCheck size={17} />
                        Close
                      </button>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
                      <div className="mx-auto max-w-4xl space-y-5">
                        <div className="flex justify-start">
                          <div className="max-w-[78%] rounded-[28px] rounded-tl-md bg-white p-5 shadow-sm ring-1 ring-zinc-100">
                            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                              {selectedTicket.tag} · {formatTicketDate(selectedTicket.sentAt)}
                            </p>
                            <p className="text-sm font-semibold leading-7 text-zinc-700">{selectedTicket.message}</p>
                          </div>
                        </div>

                        {selectedTicket.replies.map((replyItem, index) => {
                          const isTeacherReply = replyItem.senderRole === 'teacher';
                          return (
                            <div key={`${selectedTicket.id}-reply-${index}`} className={isTeacherReply ? 'flex justify-end' : 'flex justify-start'}>
                              <div className={cn(
                                'max-w-[78%] rounded-[28px] p-5 shadow-sm',
                                isTeacherReply
                                  ? 'rounded-tr-md bg-purple-600 text-white shadow-lg shadow-purple-100'
                                  : 'rounded-tl-md bg-white text-zinc-700 ring-1 ring-zinc-100',
                              )}>
                                <p className="text-sm font-semibold leading-7">{replyItem.message}</p>
                                <p className={cn(
                                  'mt-2 text-[10px] font-black uppercase tracking-widest',
                                  isTeacherReply ? 'text-purple-100' : 'text-zinc-400',
                                )}>
                                  {isTeacherReply ? 'Teacher' : replyItem.senderName} · {formatTicketDate(replyItem.repliedAt)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <footer className="shrink-0 border-t border-zinc-200 bg-white p-6">
                      <div className="mx-auto max-w-4xl">
                        <textarea
                          value={replyDraft}
                          onChange={(event) => setReplyDraft(event.target.value)}
                          disabled={selectedTicket.status === 'closed'}
                          placeholder={selectedTicket.status === 'closed' ? 'This ticket is closed' : 'Write a reply to the student...'}
                          className="min-h-28 w-full resize-none rounded-3xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold leading-6 outline-none transition focus:border-purple-300 focus:bg-white disabled:cursor-not-allowed disabled:text-zinc-400"
                        />
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-bold text-emerald-600">{statusMessage}</p>
                          <button
                            type="button"
                            onClick={sendReply}
                            disabled={!replyDraft.trim() || selectedTicket.status === 'closed'}
                            className="flex h-12 items-center gap-2 rounded-2xl bg-purple-600 px-5 text-sm font-black text-white shadow-lg shadow-purple-100 transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
                          >
                            <Reply size={17} />
                            Send reply
                          </button>
                        </div>
                      </div>
                    </footer>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                    <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-[32px] bg-white shadow-xl shadow-zinc-200">
                      <MessageSquare className="h-12 w-12 text-purple-600" />
                    </div>
                    <h2 className="text-3xl font-black text-zinc-950">Select a student ticket</h2>
                    <p className="mt-4 max-w-lg text-base font-semibold leading-7 text-zinc-500">
                      Choose a conversation from the inbox to view the request, send a reply, or close it.
                    </p>
                  </div>
                )}
              </section>

              <section className="min-h-0 overflow-y-auto bg-zinc-50 p-5 lg:hidden">
                {selectedTicket ? (
                  <div className="space-y-5 rounded-3xl bg-white p-5 shadow-sm">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-black text-purple-700">{selectedTicket.classSubject}</span>
                        <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-black capitalize', statusStyles(selectedTicket.status))}>{selectedTicket.status}</span>
                      </div>
                      <h2 className="text-2xl font-black text-zinc-950">{selectedTicket.studentName}</h2>
                      <p className="text-sm font-semibold text-zinc-500">{selectedTicket.subject}</p>
                    </div>
                    <div className="rounded-3xl bg-zinc-50 p-4">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">{formatTicketDate(selectedTicket.sentAt)}</p>
                      <p className="text-sm font-semibold leading-7 text-zinc-700">{selectedTicket.message}</p>
                    </div>
                    {selectedTicket.replies.map((replyItem, index) => (
                      <div key={`${selectedTicket.id}-mobile-reply-${index}`} className="rounded-3xl border border-zinc-100 p-4">
                        <p className="text-sm font-semibold leading-7 text-zinc-700">{replyItem.message}</p>
                        <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                          {replyItem.senderName} · {formatTicketDate(replyItem.repliedAt)}
                        </p>
                      </div>
                    ))}
                    <textarea
                      value={replyDraft}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      disabled={selectedTicket.status === 'closed'}
                      placeholder={selectedTicket.status === 'closed' ? 'This ticket is closed' : 'Write a reply...'}
                      className="min-h-28 w-full resize-none rounded-3xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold outline-none focus:border-purple-300"
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={closeTicket}
                        disabled={selectedTicket.status === 'closed'}
                        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-200 text-sm font-black text-zinc-600 disabled:opacity-50"
                      >
                        <CheckCheck size={16} />
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={sendReply}
                        disabled={!replyDraft.trim() || selectedTicket.status === 'closed'}
                        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-purple-600 text-sm font-black text-white disabled:bg-zinc-300"
                      >
                        <Reply size={16} />
                        Reply
                      </button>
                    </div>
                    {statusMessage ? <p className="text-xs font-bold text-emerald-600">{statusMessage}</p> : null}
                  </div>
                ) : null}
              </section>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default function TeacherPortalAccess({ user }: TeacherPortalAccessProps) {
  if (!user) return <TeacherLoginPanel />;
  return <TeacherTicketPortal user={user} />;
}
