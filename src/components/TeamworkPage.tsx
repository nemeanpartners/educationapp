import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from '@/lib/portal-firestore';
import { CalendarClock, CalendarDays, CheckCircle2, ClipboardList, Copy, ExternalLink, Link2, MailPlus, MessageSquare, Pencil, PlayCircle, Plus, Send, Trash2, UserCheck, Users, Video, X, CheckSquare, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import {
  buildJitsiMeetingUrl,
  generateUniversityMeetingRoomName,
  getUniversityJitsiProvisioningMessage,
  getMeetingCountdown,
  isUniversityJitsiProvisioned,
  writeActiveUniversityMeeting,
  type MeetingChecklistItem,
  type UniversityMeeting,
  type UniversityMeetingProvider,
} from '../lib/university-meetings';

type TeamMember = {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
};

type TeamTask = {
  id: string;
  text: string;
  owner: string;
  status: 'todo' | 'doing' | 'done';
};

type TeamworkProject = {
  id: string;
  userId: string;
  title: string;
  course: string;
  dueDate: string;
  memberUserIds: string[];
  memberProfiles: TeamMember[];
  members: string[];
  meetingLink: string;
  meetingMinutes: string;
  decisionsLog: string;
  tasks: TeamTask[];
  meetings: UniversityMeeting[];
  createdAt?: any;
  updatedAt?: any;
};

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

type UserDirectoryEntry = {
  uid: string;
  displayName: string;
  email: string;
  emailLower: string;
  institutionName?: string;
  degreeProgram?: string;
  photoURL?: string;
};

type TeamworkMessage = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  createdAt?: any;
};

const TEAMWORK_CHAT_LIMIT = 80;
const TEAMWORK_CHAT_RETENTION = 200;
const ZOOM_ONLINE_URL = 'https://app.zoom.us/wc';

function getTeamworkInviteId(projectId: string, toUserId: string) {
  return `${projectId}_${toUserId}`;
}

function normalizeTeamMember(member: Partial<TeamMember> | string | null | undefined, index = 0): TeamMember {
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

export default function TeamworkPage() {
  const navigate = useNavigate();
  const { isPhone } = useResponsiveDevice();
  const jitsiProvisioned = isUniversityJitsiProvisioned();
  const [projects, setProjects] = useState<TeamworkProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [memberInput, setMemberInput] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingWhen, setMeetingWhen] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [meetingChecklist, setMeetingChecklist] = useState<MeetingChecklistItem[]>([]);
  const [meetingChecklistInput, setMeetingChecklistInput] = useState('');
  const [meetingMinutesDraft, setMeetingMinutesDraft] = useState('');
  const [meetingDecisionsDraft, setMeetingDecisionsDraft] = useState('');
  const [meetingProvider, setMeetingProvider] = useState<UniversityMeetingProvider>(jitsiProvisioned ? 'jitsi' : 'zoom');
  const [meetingJoinUrl, setMeetingJoinUrl] = useState('');
  const [meetingMemberInput, setMeetingMemberInput] = useState('');
  const [selectedMeetingParticipantIds, setSelectedMeetingParticipantIds] = useState<string[]>([]);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [meetingLaunchMode, setMeetingLaunchMode] = useState<'schedule' | 'instant'>('schedule');
  const [copiedAgenda, setCopiedAgenda] = useState(false);
  const [incomingInvites, setIncomingInvites] = useState<TeamworkInvite[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<TeamworkInvite[]>([]);
  const [inviteFeedback, setInviteFeedback] = useState('');
  const [chatMessages, setChatMessages] = useState<TeamworkMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const ownedQuery = query(collection(db, 'teamworkProjects'), where('userId', '==', user.uid));
    const memberQuery = query(collection(db, 'teamworkProjects'), where('memberUserIds', 'array-contains', user.uid));

    const mergeProjects = (ownedItems: TeamworkProject[], memberItems: TeamworkProject[]) => {
      const merged = new Map<string, TeamworkProject>();
      [...ownedItems, ...memberItems].forEach((item) => merged.set(item.id, item));
      const nextItems = Array.from(merged.values()).sort((a, b) => {
        const aTime = a.updatedAt?.seconds || 0;
        const bTime = b.updatedAt?.seconds || 0;
        return bTime - aTime;
      });
      setProjects(nextItems);
      setActiveProjectId((current) => current || nextItems[0]?.id || null);
    };

    let ownedItems: TeamworkProject[] = [];
    let memberItems: TeamworkProject[] = [];

    const unsubOwned = onSnapshot(
      ownedQuery,
      (snap) => {
        ownedItems = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as TeamworkProject[];
        mergeProjects(ownedItems, memberItems);
      },
      (error) => console.error('Owned teamwork projects listener failed:', error),
    );

    const unsubMember = onSnapshot(
      memberQuery,
      (snap) => {
        memberItems = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as TeamworkProject[];
        mergeProjects(ownedItems, memberItems);
      },
      (error) => console.error('Member teamwork projects listener failed:', error),
    );

    return () => {
      unsubOwned();
      unsubMember();
    };
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const incomingQuery = query(collection(db, 'teamworkInvites'), where('toUserId', '==', user.uid));
    const outgoingQuery = query(collection(db, 'teamworkInvites'), where('fromUserId', '==', user.uid));

    const unsubIncoming = onSnapshot(
      incomingQuery,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as TeamworkInvite[];
        setIncomingInvites(items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      },
      (error) => console.error('Incoming teamwork invitations listener failed:', error),
    );

    const unsubOutgoing = onSnapshot(
      outgoingQuery,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as TeamworkInvite[];
        setOutgoingInvites(items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      },
      (error) => console.error('Outgoing teamwork invitations listener failed:', error),
    );

    return () => {
      unsubIncoming();
      unsubOutgoing();
    };
  }, []);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId],
  );

  useEffect(() => {
    if (!activeProjectId) {
      setChatMessages([]);
      return;
    }

    const chatQuery = query(
      collection(doc(db, 'teamworkProjects', activeProjectId), 'messages'),
      orderBy('createdAt', 'desc'),
      limit(TEAMWORK_CHAT_LIMIT),
    );

    const unsubscribe = onSnapshot(
      chatQuery,
      (snap) => {
        const items = snap.docs.map((messageDoc) => ({ id: messageDoc.id, ...(messageDoc.data() as any) })) as TeamworkMessage[];
        setChatMessages(items.reverse());
      },
      (error) => console.error('Teamwork chat listener failed:', error),
    );

    return () => unsubscribe();
  }, [activeProjectId]);

  const memberProfiles = useMemo(() => {
    if (!activeProject) return [];
    if (activeProject.memberProfiles?.length) {
      return activeProject.memberProfiles.map((member, index) => normalizeTeamMember(member, index));
    }
    return (activeProject.members || []).map((member, index) => normalizeTeamMember(member, index));
  }, [activeProject]);

  const teamworkAgenda = useMemo(() => {
    if (!activeProject) return '';
    return [
      `Project: ${activeProject.title}`,
      activeProject.course ? `Course: ${activeProject.course}` : '',
      activeProject.dueDate ? `Due: ${activeProject.dueDate}` : '',
      '',
      'Members:',
      ...memberProfiles.map((member) => `- ${member.displayName}${member.email ? ` (${member.email})` : ''}`),
      '',
      'Open tasks:',
      ...(activeProject.tasks || []).map((task) => `- [${task.status}] ${task.text} (${task.owner || 'Unassigned'})`),
    ]
      .filter(Boolean)
      .join('\n');
  }, [activeProject, memberProfiles]);

  const projectInvites = useMemo(() => {
    if (!activeProject) return [];
    return outgoingInvites.filter((invite) => invite.projectId === activeProject.id);
  }, [outgoingInvites, activeProject]);

  const meetingCards = useMemo(() => {
    if (!activeProject?.meetings?.length) return [];
    return [...activeProject.meetings].sort((a, b) => {
      const aTime = new Date(a.when || 0).getTime() || 0;
      const bTime = new Date(b.when || 0).getTime() || 0;
      return aTime - bTime;
    });
  }, [activeProject]);

  const nextUpcomingMeeting = useMemo(() => {
    const now = Date.now();
    return meetingCards.find((meeting) => {
      const meetingTime = new Date(meeting.when || 0).getTime();
      return meetingTime && meetingTime >= now;
    }) || null;
  }, [meetingCards]);

  const recurringMeetingSummary = useMemo(() => {
    const slots = new Map<string, { label: string; count: number }>();
    meetingCards.forEach((meeting) => {
      if (!meeting.when) return;
      const date = new Date(meeting.when);
      const label = `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${date.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })}`;
      const key = `${date.getDay()}-${date.getHours()}-${date.getMinutes()}`;
      const current = slots.get(key);
      slots.set(key, { label, count: (current?.count || 0) + 1 });
    });
    const recurring = Array.from(slots.values()).sort((a, b) => b.count - a.count)[0];
    if (!recurring || recurring.count < 2) return 'No recurring meeting pattern set';
    return `${recurring.label} recurring`;
  }, [meetingCards]);

  const latestMeetingRecord = useMemo(() => {
    const items = [...meetingCards].reverse();
    return items.find((meeting) => meeting.minutes || meeting.decisions || meeting.notes) || null;
  }, [meetingCards]);

  const selectedMeetingParticipants = useMemo(
    () => memberProfiles.filter((member) => selectedMeetingParticipantIds.includes(member.uid)),
    [memberProfiles, selectedMeetingParticipantIds],
  );

  const createProject = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const ownerProfile: TeamMember = {
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Student',
      email: user.email || '',
      photoURL: user.photoURL || '',
    };
    const ref = await addDoc(collection(db, 'teamworkProjects'), {
      userId: user.uid,
      title: 'New Team Project',
      course: '',
      dueDate: '',
      memberUserIds: [user.uid],
      memberProfiles: [ownerProfile],
      members: [],
      meetingLink: '',
      meetingMinutes: '',
      decisionsLog: '',
      tasks: [],
      meetings: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setActiveProjectId(ref.id);
  };

  const patchProject = async (patch: Partial<TeamworkProject>) => {
    if (!activeProjectId) return;
    await updateDoc(doc(db, 'teamworkProjects', activeProjectId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  };

  const addMember = async (emailOverride?: unknown) => {
    const user = auth.currentUser;
    const rawEmail = typeof emailOverride === 'string' ? emailOverride : memberInput;
    const emailLower = rawEmail.trim().toLowerCase();
    if (!activeProject || !user || !emailLower) return;
    if (emailLower === (user.email || '').toLowerCase()) {
      setInviteFeedback('You are already in this team space.');
      return;
    }

    const directorySnap = await getDocs(query(collection(db, 'userDirectory'), where('emailLower', '==', emailLower)));
    if (directorySnap.empty) {
      setInviteFeedback('No university user found with that email yet.');
      return;
    }

    const target = directorySnap.docs[0].data() as UserDirectoryEntry;
    if ((activeProject.memberUserIds || []).includes(target.uid)) {
      setInviteFeedback('That student is already in this team space.');
      return;
    }

    const duplicateInvite = outgoingInvites.find(
      (invite) => invite.projectId === activeProject.id && invite.toUserId === target.uid && invite.status === 'pending',
    );
    if (duplicateInvite) {
      setInviteFeedback('A pending invite already exists for that student.');
      return;
    }

    await setDoc(doc(db, 'teamworkInvites', getTeamworkInviteId(activeProject.id, target.uid)), {
      projectId: activeProject.id,
      projectTitle: activeProject.title,
      fromUserId: user.uid,
      fromName: user.displayName || user.email?.split('@')[0] || 'Student',
      fromEmail: user.email || '',
      toUserId: target.uid,
      toName: target.displayName,
      toEmail: target.email,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    if (typeof emailOverride === 'string') {
      setMeetingMemberInput('');
    } else {
      setMemberInput('');
    }
    setInviteFeedback(`Invite sent to ${target.displayName}.`);
  };

  const removeMember = async (member: TeamMember) => {
    if (!activeProject) return;
    await patchProject({
      memberUserIds: (activeProject.memberUserIds || []).filter((uid) => uid !== member.uid),
      memberProfiles: memberProfiles.filter((item) => item.uid !== member.uid),
      members: memberProfiles.filter((item) => item.uid !== member.uid).map((item) => item.displayName),
      tasks: (activeProject.tasks || []).map((task) =>
        task.owner === member.displayName ? { ...task, owner: 'Unassigned' } : task,
      ),
    });
  };

  const respondToInvite = async (invite: TeamworkInvite, status: 'accepted' | 'declined') => {
    const user = auth.currentUser;
    if (!user) return;

    if (status === 'accepted') {
      const localProject = projects.find((item) => item.id === invite.projectId);
      const remoteProjectSnap = localProject ? null : await getDoc(doc(db, 'teamworkProjects', invite.projectId));
      const project = localProject || (remoteProjectSnap?.exists() ? ({ id: remoteProjectSnap.id, ...(remoteProjectSnap.data() as any) } as TeamworkProject) : null);

      if (project) {
        const nextMemberProfiles = Array.from(
          new Map(
            [...(project.memberProfiles || []), {
              uid: user.uid,
              displayName: user.displayName || invite.toName || user.email?.split('@')[0] || 'Student',
              email: user.email || invite.toEmail || '',
              photoURL: user.photoURL || '',
            }].map((item) => [item.uid, item]),
          ).values(),
        );

        await updateDoc(doc(db, 'teamworkProjects', invite.projectId), {
          memberUserIds: Array.from(new Set([...(project.memberUserIds || []), user.uid])),
          memberProfiles: nextMemberProfiles,
          members: nextMemberProfiles.map((item) => item.displayName),
          updatedAt: serverTimestamp(),
        });
        setActiveProjectId(invite.projectId);
      }
    }

    await updateDoc(doc(db, 'teamworkInvites', invite.id), {
      status,
      updatedAt: serverTimestamp(),
    });
  };

  const addTask = async () => {
    if (!activeProject || !taskInput.trim()) return;
    await patchProject({
      tasks: [...(activeProject.tasks || []), { id: crypto.randomUUID(), text: taskInput.trim(), owner: 'Unassigned', status: 'todo' }],
    });
    setTaskInput('');
  };

  const updateTaskStatus = async (taskId: string, status: TeamTask['status']) => {
    if (!activeProject) return;
    await patchProject({
      tasks: (activeProject.tasks || []).map((task) => (task.id === taskId ? { ...task, status } : task)),
    });
  };

  const updateTaskOwner = async (taskId: string, owner: string) => {
    if (!activeProject) return;
    await patchProject({
      tasks: (activeProject.tasks || []).map((task) => (task.id === taskId ? { ...task, owner } : task)),
    });
  };

  const removeTask = async (taskId: string) => {
    if (!activeProject) return;
    await patchProject({
      tasks: (activeProject.tasks || []).filter((task) => task.id !== taskId),
    });
  };

  const addMeetingChecklistItem = () => {
    if (!meetingChecklistInput.trim()) return;
    setMeetingChecklist((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        text: meetingChecklistInput.trim(),
        done: false,
      },
    ]);
    setMeetingChecklistInput('');
  };

  const toggleMeetingChecklistItem = (itemId: string) => {
    setMeetingChecklist((current) =>
      current.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
    );
  };

  const removeMeetingChecklistItem = (itemId: string) => {
    setMeetingChecklist((current) => current.filter((item) => item.id !== itemId));
  };

  const resetMeetingComposer = () => {
    setMeetingTitle('');
    setMeetingWhen('');
    setMeetingNotes('');
    setMeetingAgenda('');
    setMeetingChecklist([]);
    setMeetingChecklistInput('');
    setMeetingMinutesDraft('');
    setMeetingDecisionsDraft('');
    setMeetingProvider(jitsiProvisioned ? 'jitsi' : 'zoom');
    setMeetingJoinUrl('');
    setSelectedMeetingParticipantIds([]);
    setEditingMeetingId(null);
    setMeetingLaunchMode('schedule');
    setIsMeetingModalOpen(false);
  };

  const openScheduleMeetingModal = (mode: 'schedule' | 'instant' = 'schedule') => {
    setMeetingLaunchMode(mode);
    setMeetingProvider(jitsiProvisioned ? 'jitsi' : 'zoom');
    setMeetingTitle(mode === 'instant' ? `${activeProject?.title || 'Team room'} live room` : '');
    setMeetingWhen(mode === 'instant' ? new Date().toISOString().slice(0, 16) : '');
    setSelectedMeetingParticipantIds(memberProfiles.map((member) => member.uid));
    setIsMeetingModalOpen(true);
  };

  const addMeeting = async () => {
    const user = auth.currentUser;
    if (!activeProject || !meetingTitle.trim() || !user) return;
    if (meetingProvider === 'jitsi' && !jitsiProvisioned) {
      setInviteFeedback(getUniversityJitsiProvisioningMessage());
      return;
    }
    const participantIds = selectedMeetingParticipantIds.length
      ? selectedMeetingParticipantIds
      : activeProject.memberUserIds || [];
    const participantEmails = memberProfiles
      .filter((member) => participantIds.includes(member.uid))
      .map((member) => member.email)
      .filter(Boolean);
    const roomName =
      meetingProvider === 'jitsi'
        ? generateUniversityMeetingRoomName({
            context: 'teamwork',
            userId: user.uid,
            projectId: activeProject.id,
            timestamp: meetingWhen ? new Date(meetingWhen).getTime() : Date.now(),
          })
        : '';
    const nextMeeting: UniversityMeeting = {
      id: editingMeetingId || crypto.randomUUID(),
      title: meetingTitle.trim(),
      when: meetingWhen,
      notes: meetingNotes.trim(),
      agenda: meetingAgenda.trim(),
      checklist: meetingChecklist,
      minutes: meetingMinutesDraft.trim(),
      decisions: meetingDecisionsDraft.trim(),
      provider: meetingProvider,
      roomContext: 'teamwork',
      projectId: activeProject.id,
      roomName: roomName || undefined,
      participantUserIds: participantIds,
      participantEmails,
      joinUrl: meetingProvider === 'jitsi' ? buildJitsiMeetingUrl(roomName) : meetingJoinUrl.trim(),
      status: 'scheduled',
      createdBy: user.uid,
    };

    if (editingMeetingId) {
      await patchProject({
        meetings: (activeProject.meetings || []).map((meeting) =>
          meeting.id === editingMeetingId
            ? { ...meeting, ...nextMeeting }
            : meeting,
        ),
      });
    } else {
      await patchProject({
        meetings: [...(activeProject.meetings || []), nextMeeting],
      });
    }

    if (meetingLaunchMode === 'instant' && meetingProvider === 'jitsi' && roomName) {
      writeActiveUniversityMeeting({
        meetingId: nextMeeting.id,
        projectId: activeProject.id,
        title: nextMeeting.title,
        provider: nextMeeting.provider,
        roomName,
        joinUrl: nextMeeting.joinUrl || buildJitsiMeetingUrl(roomName),
        when: nextMeeting.when,
        agenda: nextMeeting.agenda,
        moderator: true,
      });
      resetMeetingComposer();
      navigate('/uni/meeting-room-uni');
      return;
    }

    resetMeetingComposer();
  };

  const startMeetingEdit = (meeting: UniversityMeeting) => {
    setEditingMeetingId(meeting.id);
    setMeetingTitle(meeting.title);
    setMeetingWhen(meeting.when);
    setMeetingNotes(meeting.notes);
    setMeetingAgenda(meeting.agenda || '');
    setMeetingChecklist(meeting.checklist || []);
    setMeetingChecklistInput('');
    setMeetingMinutesDraft(meeting.minutes || '');
    setMeetingDecisionsDraft(meeting.decisions || '');
    setMeetingProvider(meeting.provider || 'jitsi');
    setMeetingJoinUrl(meeting.joinUrl || '');
    setSelectedMeetingParticipantIds(meeting.participantUserIds || activeProject?.memberUserIds || []);
    setMeetingLaunchMode('schedule');
    setIsMeetingModalOpen(true);
  };

  const removeMeeting = async (meetingId: string) => {
    if (!activeProject) return;
    await patchProject({
      meetings: (activeProject.meetings || []).filter((meeting) => meeting.id !== meetingId),
    });
    if (editingMeetingId === meetingId) {
      resetMeetingComposer();
    }
  };

  const cancelMeetingEdit = () => {
    resetMeetingComposer();
  };

  const deleteProject = async () => {
    if (!activeProjectId) return;
    const currentId = activeProjectId;
    const remainingProjects = projects.filter((project) => project.id !== currentId);
    await deleteDoc(doc(db, 'teamworkProjects', currentId));
    setActiveProjectId(remainingProjects[0]?.id ?? null);
  };

  const copyAgenda = async () => {
    if (!teamworkAgenda) return;
    await navigator.clipboard.writeText(teamworkAgenda);
    setCopiedAgenda(true);
    setTimeout(() => setCopiedAgenda(false), 1600);
  };

  const joinMeeting = (meeting: UniversityMeeting) => {
    const joinUrl =
      meeting.provider === 'jitsi'
        ? buildJitsiMeetingUrl(meeting.roomName || generateUniversityMeetingRoomName({ context: 'teamwork', projectId: activeProject?.id }))
        : meeting.joinUrl || activeProject?.meetingLink || 'https://app.zoom.us/wc';

    if (meeting.provider === 'jitsi' && jitsiProvisioned) {
      writeActiveUniversityMeeting({
        meetingId: meeting.id,
        projectId: activeProject?.id,
        title: meeting.title,
        provider: 'jitsi',
        roomName: meeting.roomName,
        joinUrl,
        when: meeting.when,
        agenda: meeting.agenda,
        moderator: meeting.createdBy === auth.currentUser?.uid,
      });
      navigate('/uni/meeting-room-uni');
      return;
    }

    window.open(joinUrl, '_blank', 'noopener,noreferrer');
  };

  const openZoomOnline = () => {
    window.open(ZOOM_ONLINE_URL, '_blank', 'noopener,noreferrer');
  };

  const toggleMeetingParticipant = (uid: string) => {
    setSelectedMeetingParticipantIds((current) =>
      current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid],
    );
  };

  const pruneProjectChat = async (projectId: string) => {
    const messagesRef = collection(doc(db, 'teamworkProjects', projectId), 'messages');
    const snapshot = await getDocs(query(messagesRef, orderBy('createdAt', 'desc')));
    const staleDocs = snapshot.docs.slice(TEAMWORK_CHAT_RETENTION);
    if (!staleDocs.length) return;
    await Promise.all(staleDocs.map((messageDoc) => deleteDoc(messageDoc.ref)));
  };

  const sendChatMessage = async () => {
    const user = auth.currentUser;
    const text = chatInput.trim();
    if (!user || !activeProject || !text) return;

    await addDoc(collection(doc(db, 'teamworkProjects', activeProject.id), 'messages'), {
      text,
      authorId: user.uid,
      authorName: user.displayName || user.email?.split('@')[0] || 'Student',
      authorEmail: user.email || '',
      createdAt: serverTimestamp(),
    });

    setChatInput('');
    void pruneProjectChat(activeProject.id);
  };

  const formatChatTimestamp = (value?: any) => {
    if (!value) return 'Just now';
    try {
      const date =
        typeof value?.toDate === 'function'
          ? value.toDate()
          : typeof value?.seconds === 'number'
            ? new Date(value.seconds * 1000)
            : new Date(value);

      if (Number.isNaN(date.getTime())) return 'Just now';
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[36px] border border-white/60 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.78))] p-8 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-600">Teamwork</p>
            <h1 className="text-4xl font-black tracking-tight text-zinc-950">Run group work like a project room, not a group chat.</h1>
            <p className="max-w-3xl text-lg leading-8 text-zinc-600">
              Coordinate members, meetings, minutes, decisions, and deliverables from one university-grade workspace.
            </p>
            {!jitsiProvisioned ? (
              <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-7 text-amber-900">
                {getUniversityJitsiProvisioningMessage()}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            {jitsiProvisioned ? (
              <>
                <button
                  onClick={() => openScheduleMeetingModal('instant')}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-700 shadow-sm transition hover:border-zinc-300"
                >
                  <PlayCircle size={16} />
                  Start in-app Jitsi room
                </button>
                <button
                  onClick={openZoomOnline}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-5 py-3 text-sm font-black text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-100"
                >
                  Open Zoom
                  <ExternalLink size={16} />
                </button>
                <button
                  onClick={() => openScheduleMeetingModal('schedule')}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-700 shadow-sm transition hover:border-zinc-300"
                >
                  <CalendarClock size={16} />
                  Schedule in-app Jitsi room
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/uni/meeting-room-uni')}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-black text-amber-900 shadow-sm transition hover:bg-amber-100"
              >
                <Video size={16} />
                In-app meeting unavailable
              </button>
            )}
            <button
              onClick={createProject}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-zinc-200 transition hover:bg-zinc-800"
            >
              <Plus size={16} />
              New Team Space
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[30px] border border-white/60 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Project spaces</p>
          <p className="text-sm font-semibold text-zinc-500">{projects.length} active</p>
        </div>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setActiveProjectId(project.id)}
                className={cn(
                  'min-w-[260px] rounded-[24px] border px-4 py-4 text-left transition',
                  project.id === activeProjectId
                    ? 'border-slate-300 bg-slate-50 shadow-sm'
                    : 'border-zinc-200 bg-white hover:border-zinc-300',
                )}
              >
                <p className="text-base font-black text-zinc-900">{project.title}</p>
                <p className="mt-1 text-sm text-zinc-500">{project.course || 'Course not set'}</p>
              </button>
            ))}
            {!projects.length && (
              <div className="min-w-[320px] rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50 px-5 py-6 text-sm text-zinc-500">
                Create a team space to track group members, tasks, and meetings.
              </div>
            )}
        </div>
      </div>

      <div className="rounded-[32px] border border-white/60 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        {activeProject ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2.5">
                <div className="rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                  {memberProfiles.length} members
                </div>
                <div className="rounded-full bg-indigo-50 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
                  {(activeProject.tasks || []).filter((task) => task.status !== 'done').length} open tasks
                </div>
                <div className="rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                  {meetingCards.length} meetings
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={copyAgenda}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-700 transition hover:border-zinc-300"
                >
                  <Copy size={13} />
                  {copiedAgenda ? 'Copied' : 'Copy agenda'}
                </button>
                <button
                  onClick={deleteProject}
                  className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-rose-600 transition hover:bg-rose-100"
                >
                  <Trash2 size={13} />
                  Delete team space
                </button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_200px]">
              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Project title</span>
                <input
                  value={activeProject.title || ''}
                  onChange={(event) => patchProject({ title: event.target.value })}
                  className="w-full rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-blue-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Course</span>
                <input
                  value={activeProject.course || ''}
                  onChange={(event) => patchProject({ course: event.target.value })}
                  className="w-full rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-blue-400"
                  placeholder="e.g. Systems Design"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Due date</span>
                <input
                  type="date"
                  value={activeProject.dueDate || ''}
                  onChange={(event) => patchProject({ dueDate: event.target.value })}
                  className="w-full rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-blue-400"
                />
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-fuchsia-600" />
                  <h2 className="text-lg font-black text-zinc-950">Project overview</h2>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-zinc-200 bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Next meeting</p>
                    <p className="mt-2 text-sm font-black text-zinc-900">
                      {nextUpcomingMeeting?.when ? new Date(nextUpcomingMeeting.when).toLocaleString() : 'Not scheduled'}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-zinc-200 bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Meeting rhythm</p>
                    <p className="mt-2 text-sm font-black text-zinc-900">{recurringMeetingSummary}</p>
                  </div>
                  <div className="rounded-[18px] border border-zinc-200 bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Assigned tasks</p>
                    <p className="mt-2 text-sm font-black text-zinc-900">
                      {(activeProject.tasks || []).filter((task) => task.owner && task.owner !== 'Unassigned').length} allocated
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-zinc-200 bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Completed tasks</p>
                    <p className="mt-2 text-sm font-black text-zinc-900">
                      {(activeProject.tasks || []).filter((task) => task.status === 'done').length} finished
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-lg font-black text-zinc-950">Meeting operations</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Launch or schedule the room, then work from the Meeting Room while the call is active.
                </p>
                <div className="mt-4 grid gap-2.5">
                  {jitsiProvisioned ? (
                    <>
                      <button
                        onClick={() => openScheduleMeetingModal('instant')}
                        className="inline-flex items-center justify-between rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-700 transition hover:border-zinc-300"
                      >
                        Start in-app Jitsi room
                        <PlayCircle size={14} />
                      </button>
                      <button
                        onClick={openZoomOnline}
                        className="inline-flex items-center justify-between rounded-[16px] border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-100"
                      >
                        Open Zoom
                        <ExternalLink size={14} />
                      </button>
                      <button
                        onClick={() => openScheduleMeetingModal('schedule')}
                        className="inline-flex items-center justify-between rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-700 transition hover:border-zinc-300"
                      >
                        Schedule in-app Jitsi room
                        <CalendarClock size={14} />
                      </button>
                    </>
                  ) : (
                    <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-semibold leading-7 text-amber-900">
                      {getUniversityJitsiProvisioningMessage()}
                    </div>
                  )}
                  <button
                    onClick={() => navigate('/uni/meeting-room-uni')}
                    className="inline-flex items-center justify-between rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-700 transition hover:border-zinc-300"
                  >
                    Open Meeting Room page
                    <Video size={14} />
                  </button>
                </div>
              </div>

              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5">
                <div className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-zinc-700" />
                  <h2 className="text-lg font-black text-zinc-950">External meeting link</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Optional fallback only. Keep this compact so the project room stays focused on the in-app workflow.
                </p>
                <label className="mt-4 block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Zoom or Teams link</span>
                  <input
                    value={activeProject.meetingLink || ''}
                    onChange={(event) => patchProject({ meetingLink: event.target.value })}
                    className="w-full rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-blue-400"
                    placeholder="Optional external room"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-lg font-black text-zinc-950">Meeting timetable</h2>
                </div>
                <p className="text-sm text-zinc-500">Upcoming rooms, recurring patterns, and join access for every accepted member.</p>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_320px]">
                <div className="grid gap-3 xl:grid-cols-2">
                  {meetingCards.map((meeting) => {
                    const countdown = getMeetingCountdown(meeting.when);
                    return (
                      <div key={meeting.id} className="rounded-[18px] border border-zinc-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-zinc-900">{meeting.title}</p>
                            <p className="mt-1 text-xs font-semibold text-zinc-500">
                              {meeting.when ? new Date(meeting.when).toLocaleString() : 'Time not set'}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                              meeting.provider === 'jitsi' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700',
                            )}
                          >
                            {meeting.provider}
                          </span>
                        </div>
                        {countdown ? (
                          <div
                            className={cn(
                              'mt-3 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                              countdown.isSoon ? 'bg-amber-50 text-amber-700' : 'bg-zinc-100 text-zinc-600',
                            )}
                          >
                            {countdown.label}
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={() => joinMeeting(meeting)}
                            className="rounded-full bg-zinc-950 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-zinc-800"
                          >
                            Join
                          </button>
                          <button
                            onClick={() => startMeetingEdit(meeting)}
                            className="rounded-full bg-zinc-100 p-2 text-zinc-600 transition hover:bg-zinc-200"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => removeMeeting(meeting.id)}
                            className="rounded-full bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!meetingCards.length && (
                    <div className="rounded-[18px] border border-dashed border-zinc-200 bg-white px-4 py-5 text-sm text-zinc-500 xl:col-span-2">
                      No meetings yet. Start now or schedule a room and it will appear here and on every member's Meeting Room page.
                    </div>
                  )}
                </div>
                <div className="rounded-[20px] border border-zinc-200 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Project timetable</p>
                  <div className="mt-3 space-y-2">
                    {meetingCards.slice(0, 5).map((meeting) => (
                      <div key={`${meeting.id}-timeline`} className="rounded-[14px] bg-zinc-50 px-3 py-3">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">
                          {meeting.when
                            ? new Date(meeting.when).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
                            : 'Date pending'}
                        </div>
                        <div className="mt-1 text-sm font-black text-zinc-900">
                          {meeting.when
                            ? new Date(meeting.when).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                            : 'Time pending'}
                        </div>
                        <div className="mt-1 text-sm text-zinc-500">{meeting.title}</div>
                      </div>
                    ))}
                    {!meetingCards.length && <div className="rounded-[14px] bg-zinc-50 px-3 py-4 text-sm text-zinc-500">No meeting timetable set yet.</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-6">
                {!!incomingInvites.filter((invite) => invite.status === 'pending').length && (
                  <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-5">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-emerald-700" />
                      <h2 className="text-lg font-black text-zinc-950">Pending invites for you</h2>
                    </div>
                    <div className="mt-4 space-y-3">
                      {incomingInvites.filter((invite) => invite.status === 'pending').map((invite) => (
                        <div key={invite.id} className="rounded-[18px] border border-emerald-200 bg-white px-4 py-4">
                          <p className="text-sm font-black text-zinc-900">{invite.projectTitle}</p>
                          <p className="mt-1 text-sm text-zinc-600">{invite.fromName} invited you to join this team room.</p>
                          <div className="mt-3 flex flex-wrap gap-3">
                            <button
                              onClick={() => respondToInvite(invite, 'accepted')}
                              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-800"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => respondToInvite(invite, 'declined')}
                              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-black text-zinc-600 transition hover:border-zinc-300"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-slate-600" />
                    <h2 className="text-lg font-black text-zinc-950">Members</h2>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input
                      value={memberInput}
                      onChange={(event) => setMemberInput(event.target.value)}
                      className="flex-1 rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 outline-none focus:border-blue-400"
                      placeholder="Invite by university email"
                    />
                    <button onClick={() => addMember()} className="rounded-full bg-zinc-950 px-4 text-sm font-black text-white transition hover:bg-zinc-800">
                      Invite
                    </button>
                  </div>
                  {inviteFeedback ? (
                    <div className="mt-3 rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-600">
                      {inviteFeedback}
                    </div>
                  ) : null}
                  <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                    {memberProfiles.map((member) => {
                      const memberInvite = projectInvites.find((invite) => invite.toUserId === member.uid);
                      const statusLabel = member.uid === activeProject.userId ? 'Owner' : memberInvite?.status || 'accepted';
                      return (
                        <div key={member.uid} className="flex items-center justify-between gap-3 rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700">
                          <div className="min-w-0">
                            <div className="truncate text-zinc-900">{member.displayName}</div>
                            <div className="truncate text-xs font-semibold text-zinc-500">{member.email || 'University member'}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={cn(
                                'rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]',
                                statusLabel === 'Owner'
                                  ? 'bg-zinc-100 text-zinc-500'
                                  : statusLabel === 'accepted'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : statusLabel === 'declined'
                                      ? 'bg-rose-50 text-rose-700'
                                      : 'bg-amber-50 text-amber-700',
                              )}
                            >
                              {statusLabel}
                            </span>
                            {member.uid !== activeProject.userId ? (
                              <button
                                onClick={() => removeMember(member)}
                                className="rounded-full bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {!memberProfiles.length && (
                      <div className="rounded-[16px] border border-dashed border-zinc-200 bg-white px-4 py-5 text-sm text-zinc-500">
                        Invite university teammates by email so accepted users join the shared project room.
                      </div>
                    )}
                  </div>
                  {!!projectInvites.filter((invite) => !(activeProject.memberUserIds || []).includes(invite.toUserId)).length && (
                    <div className="mt-4 rounded-[18px] border border-zinc-200 bg-white p-4">
                      <div className="flex items-center gap-2">
                        <MailPlus className="h-4 w-4 text-indigo-600" />
                        <p className="text-sm font-black text-zinc-900">Invited teammates</p>
                      </div>
                      <div className="mt-3 space-y-2">
                        {projectInvites
                          .filter((invite) => !(activeProject.memberUserIds || []).includes(invite.toUserId))
                          .map((invite) => (
                          <div key={invite.id} className="flex items-center justify-between gap-3 rounded-[14px] bg-zinc-50 px-3 py-3 text-sm">
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-zinc-800">{invite.toName || invite.toEmail}</div>
                              <div className="truncate text-xs text-zinc-500">{invite.toEmail}</div>
                            </div>
                            <span
                              className={cn(
                                'rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em]',
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
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-fuchsia-600" />
                    <h2 className="text-lg font-black text-zinc-950">Project brief</h2>
                  </div>
                  <div className="mt-4 rounded-[18px] border border-zinc-200 bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Shared project agenda</p>
                    <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-700">{teamworkAgenda}</pre>
                  </div>
                  {latestMeetingRecord ? (
                    <div className="mt-4 rounded-[18px] border border-zinc-200 bg-white p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Latest meeting record</p>
                      <p className="mt-2 text-sm font-black text-zinc-900">{latestMeetingRecord.title}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">
                        {latestMeetingRecord.minutes || latestMeetingRecord.decisions || latestMeetingRecord.notes}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5 text-zinc-700" />
                    <h2 className="text-lg font-black text-zinc-950">External meeting fallback</h2>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">
                    Use these only when a course or supervisor requires Zoom. The default team workflow should stay inside the EducationRev Meeting Room.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <a
                      href={activeProject.meetingLink || 'https://app.zoom.us/wc'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-between rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-700 transition hover:border-zinc-300"
                    >
                      Open Zoom room
                      <ExternalLink size={14} />
                    </a>
                    <a
                      href="https://zoom.us/meeting/schedule"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-between rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-700 transition hover:border-zinc-300"
                    >
                      Book Zoom meeting
                      <CalendarDays size={14} />
                    </a>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-sky-600" />
                      <h2 className="text-lg font-black text-zinc-950">Team chat</h2>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      Recent only
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Use this for fast coordination. It keeps a rolling recent history instead of storing an unlimited archive.
                  </p>
                  <div className="mt-4 rounded-[20px] border border-zinc-200 bg-white">
                    <div className="max-h-[340px] space-y-3 overflow-y-auto p-4">
                      {chatMessages.map((message) => {
                        const isOwn = message.authorId === auth.currentUser?.uid;
                        return (
                          <div key={message.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                            <div
                              className={cn(
                                'max-w-[85%] rounded-[18px] px-4 py-3 shadow-sm',
                                isOwn ? 'bg-zinc-950 text-white' : 'border border-zinc-200 bg-zinc-50 text-zinc-900',
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className={cn('text-xs font-black', isOwn ? 'text-white/60' : 'text-zinc-500')}>
                                  {isOwn ? 'You' : message.authorName}
                                </span>
                                <span className={cn('text-[11px] font-semibold', isOwn ? 'text-white/45' : 'text-zinc-400')}>
                                  {formatChatTimestamp(message.createdAt)}
                                </span>
                              </div>
                              <p className={cn('mt-1 whitespace-pre-wrap text-sm leading-6', isOwn ? 'text-white' : 'text-zinc-700')}>
                                {message.text}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {!chatMessages.length && (
                        <div className="rounded-[16px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-sm text-zinc-500">
                          No messages yet. Use this for decisions, quick updates, and links, not as a permanent document store.
                        </div>
                      )}
                    </div>
                    <div className="border-t border-zinc-200 p-3">
                      <div className="flex items-end gap-2">
                        <textarea
                          value={chatInput}
                          onChange={(event) => setChatInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              void sendChatMessage();
                            }
                          }}
                          className="min-h-[52px] flex-1 rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-800 outline-none transition focus:border-sky-400"
                          placeholder="Send a quick update to the team"
                        />
                        <button
                          onClick={() => void sendChatMessage()}
                          className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[16px] bg-zinc-950 px-4 text-sm font-black text-white transition hover:bg-zinc-800"
                        >
                          <Send size={15} />
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-fuchsia-600" />
                      <h2 className="text-lg font-black text-zinc-950">Task board</h2>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      {activeProject.tasks?.length || 0} tasks
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <input
                      value={taskInput}
                      onChange={(event) => setTaskInput(event.target.value)}
                      className="flex-1 rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 outline-none focus:border-blue-400"
                      placeholder="Add a task"
                    />
                    <button onClick={addTask} className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800">
                      Add
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(activeProject.tasks || []).map((task) => (
                      <div key={task.id} className="grid gap-3 rounded-[18px] border border-zinc-200 bg-white px-4 py-4 lg:grid-cols-[minmax(220px,1.3fr)_170px_130px_44px] lg:items-center">
                        <div className="min-w-0">
                          <div className="text-sm font-black leading-6 text-zinc-900">{task.text}</div>
                        </div>
                        <select
                          value={task.owner}
                          onChange={(event) => updateTaskOwner(task.id, event.target.value)}
                          className="rounded-[12px] border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-black text-zinc-700 outline-none"
                        >
                          <option value="Unassigned">Unassigned</option>
                          {memberProfiles.map((member) => (
                            <option key={`${task.id}-${member.uid}`} value={member.displayName}>
                              {member.displayName}
                            </option>
                          ))}
                        </select>
                        <select
                          value={task.status}
                          onChange={(event) => updateTaskStatus(task.id, event.target.value as TeamTask['status'])}
                          className="rounded-[12px] border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-zinc-700 outline-none"
                        >
                          <option value="todo">To do</option>
                          <option value="doing">Doing</option>
                          <option value="done">Done</option>
                        </select>
                        <button
                          onClick={() => removeTask(task.id)}
                          className="justify-self-start rounded-full bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100 lg:justify-self-end"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {!(activeProject.tasks || []).length && (
                      <div className="rounded-[16px] border border-dashed border-zinc-200 bg-white px-4 py-8 text-sm text-zinc-500">
                        No tasks yet. Add deliverables and assign owners here.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
            <div className="rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-12 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-zinc-300" />
              <h2 className="mt-4 text-2xl font-black text-zinc-900">Create a team space</h2>
              <p className="mt-2 text-zinc-500">Give university project work a dedicated place for tasks, members, and meetings.</p>
            </div>
          )}
      </div>

      {isMeetingModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[34px] border border-white/60 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.2)]">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-400">
                  {editingMeetingId ? 'Edit meeting' : 'Schedule meeting'}
                </p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-zinc-950">
                  {meetingProvider === 'jitsi' ? 'Schedule Jitsi meeting' : 'Schedule Zoom meeting'}
                </h2>
                <p className="mt-2 text-sm leading-7 text-zinc-600">
                  Pick a time, set the agenda, choose members, and save a shared meeting card to every participant's university workspace.
                </p>
              </div>
              <button
                onClick={cancelMeetingEdit}
                className="rounded-full bg-zinc-100 p-3 text-zinc-500 transition hover:bg-zinc-200"
                aria-label="Close meeting scheduler"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Meeting title</span>
                      <input
                        value={meetingTitle}
                        onChange={(event) => setMeetingTitle(event.target.value)}
                        className="w-full rounded-[20px] border border-zinc-200 bg-white px-4 py-3 text-base font-semibold text-zinc-900 outline-none transition focus:border-indigo-400"
                        placeholder="e.g. Systems report planning session"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Date and time</span>
                      <input
                        type="datetime-local"
                        value={meetingWhen}
                        onChange={(event) => setMeetingWhen(event.target.value)}
                        className="w-full rounded-[20px] border border-zinc-200 bg-white px-4 py-3 text-base font-semibold text-zinc-900 outline-none transition focus:border-indigo-400"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Provider</span>
                      <select
                        value={meetingProvider}
                        onChange={(event) => setMeetingProvider(event.target.value as UniversityMeetingProvider)}
                        className="w-full rounded-[20px] border border-zinc-200 bg-white px-4 py-3 text-base font-semibold text-zinc-900 outline-none transition focus:border-indigo-400"
                      >
                        {jitsiProvisioned ? <option value="jitsi">In-app Jitsi room</option> : null}
                        <option value="zoom">Zoom</option>
                      </select>
                    </label>
                    {!jitsiProvisioned ? (
                      <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-semibold leading-7 text-amber-900 md:col-span-2">
                        In-app Jitsi is not available yet, so scheduled university meetings are currently saved as Zoom/external meetings only.
                      </div>
                    ) : null}
                    {meetingProvider === 'zoom' ? (
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Zoom join link</span>
                        <input
                          value={meetingJoinUrl}
                          onChange={(event) => setMeetingJoinUrl(event.target.value)}
                          className="w-full rounded-[20px] border border-zinc-200 bg-white px-4 py-3 text-base font-semibold text-zinc-900 outline-none transition focus:border-indigo-400"
                          placeholder="https://zoom.us/j/..."
                        />
                      </label>
                    ) : null}
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Agenda</span>
                      <textarea
                        value={meetingAgenda}
                        onChange={(event) => setMeetingAgenda(event.target.value)}
                        className="min-h-[140px] w-full rounded-[20px] border border-zinc-200 bg-white px-4 py-4 text-sm leading-6 text-zinc-800 outline-none transition focus:border-indigo-400"
                        placeholder="List the agenda items, sections to review, and decisions you need from the team."
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Pre-meeting notes</span>
                      <textarea
                        value={meetingNotes}
                        onChange={(event) => setMeetingNotes(event.target.value)}
                        className="min-h-[120px] w-full rounded-[20px] border border-zinc-200 bg-white px-4 py-4 text-sm leading-6 text-zinc-800 outline-none transition focus:border-indigo-400"
                        placeholder="Add prep notes, links to read before the meeting, or reminders for the team."
                      />
                    </label>

                    <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-4 md:col-span-2">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-5 w-5 text-fuchsia-600" />
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Meeting prep</p>
                          <h3 className="text-lg font-black text-zinc-950">Checklist for the room</h3>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <input
                          value={meetingChecklistInput}
                          onChange={(event) => setMeetingChecklistInput(event.target.value)}
                          className="flex-1 rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition focus:border-indigo-400"
                          placeholder="Add an item attendees need to cover"
                        />
                        <button
                          onClick={addMeetingChecklistItem}
                          className="rounded-full bg-zinc-950 px-4 text-sm font-black text-white transition hover:bg-zinc-800"
                        >
                          Add
                        </button>
                      </div>
                      <div className="mt-4 space-y-2">
                        {meetingChecklist.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 rounded-[16px] border border-zinc-200 bg-white px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleMeetingChecklistItem(item.id)}
                              className={cn(
                                'flex h-5 w-5 items-center justify-center rounded-md border transition',
                                item.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-zinc-300 bg-white text-transparent',
                              )}
                            >
                              <CheckCircle2 size={12} />
                            </button>
                            <span className={cn('flex-1 text-sm', item.done ? 'text-zinc-400 line-through' : 'text-zinc-700')}>
                              {item.text}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeMeetingChecklistItem(item.id)}
                              className="rounded-full bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                        {!meetingChecklist.length && (
                          <div className="rounded-[16px] border border-dashed border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-500">
                            Add checklist items so the room opens with a clear agenda and action sequence.
                          </div>
                        )}
                      </div>
                    </div>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Meeting minutes scaffold</span>
                      <textarea
                        value={meetingMinutesDraft}
                        onChange={(event) => setMeetingMinutesDraft(event.target.value)}
                        className="min-h-[140px] w-full rounded-[20px] border border-zinc-200 bg-white px-4 py-4 text-sm leading-6 text-zinc-800 outline-none transition focus:border-indigo-400"
                        placeholder="Record attendees, discussion flow, evidence reviewed, blockers, and follow-up items."
                      />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Decisions and actions</span>
                      <textarea
                        value={meetingDecisionsDraft}
                        onChange={(event) => setMeetingDecisionsDraft(event.target.value)}
                        className="min-h-[120px] w-full rounded-[20px] border border-zinc-200 bg-white px-4 py-4 text-sm leading-6 text-zinc-800 outline-none transition focus:border-indigo-400"
                        placeholder="Capture key decisions, owners, deadlines, and unresolved points."
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Members</p>
                        <h3 className="mt-1 text-xl font-black text-zinc-950">Send card to participants</h3>
                      </div>
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
                        {selectedMeetingParticipants.length} selected
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <input
                        value={meetingMemberInput}
                        onChange={(event) => setMeetingMemberInput(event.target.value)}
                        className="flex-1 rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition focus:border-indigo-400"
                        placeholder="Add another university member by email"
                      />
                      <button
                        onClick={() => addMember(meetingMemberInput)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950 text-white transition hover:bg-zinc-800"
                        aria-label="Add member to project"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    {inviteFeedback ? (
                      <div className="mt-3 rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-600">
                        {inviteFeedback}
                      </div>
                    ) : null}
                    <div className="mt-4 max-h-[340px] space-y-2 overflow-y-auto pr-1">
                      {memberProfiles.map((member) => {
                        const checked = selectedMeetingParticipantIds.includes(member.uid);
                        return (
                          <label
                            key={member.uid}
                            className={cn(
                              'flex cursor-pointer items-start justify-between gap-3 rounded-[18px] border px-4 py-3 transition',
                              checked ? 'border-indigo-300 bg-white shadow-sm' : 'border-zinc-200 bg-white',
                            )}
                          >
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-zinc-900">{member.displayName}</div>
                              <div className="truncate text-xs font-semibold text-zinc-500">{member.email || 'University member'}</div>
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMeetingParticipant(member.uid)}
                              className="mt-1 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-4 text-sm leading-7 text-zinc-600">
                    Scheduled meeting cards are saved on the shared team project. Every accepted member selected here will see the card in their `Meeting Room` page and in this team space.
                  </div>

                  <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-4 text-sm leading-7 text-zinc-600">
                    The same agenda, checklist, minutes scaffold, and decision log will appear inside the Meeting Room while the call is live so your team can work against the same structure during the meeting.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-6 py-5">
              <button
                onClick={cancelMeetingEdit}
                className="rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-600 transition hover:border-zinc-300"
              >
                Cancel
              </button>
              <div className="flex flex-wrap gap-3">
                {meetingProvider === 'zoom' ? (
                  <a
                    href="https://zoom.us/meeting/schedule"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-700 transition hover:border-zinc-300"
                  >
                    <ExternalLink size={15} />
                    Open Zoom scheduler
                  </a>
                ) : null}
                <button
                  onClick={addMeeting}
                  className="rounded-full bg-zinc-950 px-6 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
                >
                  {meetingLaunchMode === 'instant'
                    ? editingMeetingId
                      ? 'Save and reopen room'
                      : 'Start meeting now'
                    : editingMeetingId
                      ? 'Save meeting changes'
                      : 'Save scheduled meeting'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
