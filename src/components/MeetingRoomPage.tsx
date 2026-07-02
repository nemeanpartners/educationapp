import { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../firebase';
import { collection, doc, onSnapshot, query, updateDoc, where } from '@/lib/portal-firestore';
import { AlertCircle, CalendarDays, CheckCircle2, CheckSquare, Copy, ExternalLink, FileText, Loader2, Plus, Sparkles, Trash2, Users, Video } from 'lucide-react';
import { cn } from '../lib/utils';
import EmbeddedJitsiRoom from './EmbeddedJitsiRoom';
import { geminiService } from '../services/gemini';
import {
  buildJitsiMeetingUrl,
  getUniversityJitsiProvisioningMessage,
  isUniversityJitsiProvisioned,
  clearActiveUniversityMeeting,
  getMeetingCountdown,
  readActiveUniversityMeeting,
  subscribeActiveUniversityMeeting,
  type ActiveUniversityMeeting,
  type MeetingChecklistItem,
  type UniversityMeeting,
} from '../lib/university-meetings';

type TeamworkProjectMeetingRoom = {
  id: string;
  title: string;
  course: string;
  memberUserIds: string[];
  meetings: UniversityMeeting[];
  updatedAt?: any;
};

type FlattenedMeeting = UniversityMeeting & {
  projectTitle: string;
  course: string;
  projectId: string;
};

export default function MeetingRoomPage() {
  const currentUser = auth.currentUser;
  const jitsiProvisioned = isUniversityJitsiProvisioned();
  const [projects, setProjects] = useState<TeamworkProjectMeetingRoom[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<ActiveUniversityMeeting | null>(() => readActiveUniversityMeeting());
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [checklistInput, setChecklistInput] = useState('');
  const [minutesDraft, setMinutesDraft] = useState('');
  const [decisionsDraft, setDecisionsDraft] = useState('');
  const [isEnhancingMinutes, setIsEnhancingMinutes] = useState(false);
  const [minutesAiError, setMinutesAiError] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => subscribeActiveUniversityMeeting(setActiveMeeting), []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ownedQuery = query(collection(db, 'teamworkProjects'), where('userId', '==', user.uid));
    const memberQuery = query(collection(db, 'teamworkProjects'), where('memberUserIds', 'array-contains', user.uid));

    let ownedItems: TeamworkProjectMeetingRoom[] = [];
    let memberItems: TeamworkProjectMeetingRoom[] = [];

    const mergeProjects = () => {
      const merged = new Map<string, TeamworkProjectMeetingRoom>();
      [...ownedItems, ...memberItems].forEach((item) => merged.set(item.id, item));
      const nextItems = Array.from(merged.values()).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setProjects(nextItems);
    };

    const unsubOwned = onSnapshot(ownedQuery, (snap) => {
      ownedItems = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as TeamworkProjectMeetingRoom[];
      mergeProjects();
    });

    const unsubMember = onSnapshot(memberQuery, (snap) => {
      memberItems = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as TeamworkProjectMeetingRoom[];
      mergeProjects();
    });

    return () => {
      unsubOwned();
      unsubMember();
    };
  }, []);

  const meetings = useMemo<FlattenedMeeting[]>(() => {
    return projects
      .flatMap((project) =>
        (project.meetings || []).map((meeting) => ({
          ...meeting,
          projectTitle: project.title,
          course: project.course,
          projectId: project.id,
        })),
      )
      .filter((meeting) => {
        if (!meeting.participantUserIds?.length) return true;
        return !!currentUser?.uid && meeting.participantUserIds.includes(currentUser.uid);
      })
      .sort((a, b) => {
        const aTime = new Date(a.when || 0).getTime() || 0;
        const bTime = new Date(b.when || 0).getTime() || 0;
        return aTime - bTime;
      });
  }, [projects]);

  useEffect(() => {
    if (!selectedMeetingId && meetings.length) {
      setSelectedMeetingId(activeMeeting?.meetingId || meetings[0].id);
    }
  }, [meetings, selectedMeetingId, activeMeeting]);

  const selectedMeeting =
    meetings.find((meeting) => meeting.id === selectedMeetingId) ||
    (activeMeeting ? meetings.find((meeting) => meeting.id === activeMeeting.meetingId) : null) ||
    null;

  const selectedMeetingUrl =
    selectedMeeting?.provider === 'jitsi'
      ? buildJitsiMeetingUrl(selectedMeeting.roomName || '')
      : selectedMeeting?.joinUrl || '';

  const upcomingSoonMeetings = meetings.filter((meeting) => getMeetingCountdown(meeting.when)?.isSoon);

  useEffect(() => {
    setMinutesDraft(selectedMeeting?.minutes || '');
    setDecisionsDraft(selectedMeeting?.decisions || '');
    setChecklistInput('');
  }, [selectedMeeting?.id]);

  const patchMeeting = async (meetingId: string, projectId: string, patch: Partial<UniversityMeeting>) => {
    const projectRef = doc(db, 'teamworkProjects', projectId);
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;

    const nextMeetings = (project.meetings || []).map((meeting) =>
      meeting.id === meetingId ? { ...meeting, ...patch } : meeting,
    );

    setProjects((current) =>
      current.map((item) => (item.id === projectId ? { ...item, meetings: nextMeetings } : item)),
    );
    await updateDoc(projectRef, { meetings: nextMeetings });
  };

  useEffect(() => {
    if (!selectedMeeting) return;
    const timer = window.setTimeout(() => {
      if (minutesDraft !== (selectedMeeting.minutes || '') || decisionsDraft !== (selectedMeeting.decisions || '')) {
        patchMeeting(selectedMeeting.id, selectedMeeting.projectId, {
          minutes: minutesDraft,
          decisions: decisionsDraft,
        }).catch(() => undefined);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [minutesDraft, decisionsDraft, selectedMeeting]);

  const toggleChecklistItem = (itemId: string) => {
    if (!selectedMeeting) return;
    const nextChecklist = (selectedMeeting.checklist || []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item,
    );
    patchMeeting(selectedMeeting.id, selectedMeeting.projectId, { checklist: nextChecklist }).catch(() => undefined);
  };

  const addChecklistItem = () => {
    if (!selectedMeeting || !checklistInput.trim()) return;
    const nextChecklist = [
      ...(selectedMeeting.checklist || []),
      { id: `check-${Date.now()}`, text: checklistInput.trim(), done: false } satisfies MeetingChecklistItem,
    ];
    setChecklistInput('');
    patchMeeting(selectedMeeting.id, selectedMeeting.projectId, { checklist: nextChecklist }).catch(() => undefined);
  };

  const removeChecklistItem = (itemId: string) => {
    if (!selectedMeeting) return;
    const nextChecklist = (selectedMeeting.checklist || []).filter((item) => item.id !== itemId);
    patchMeeting(selectedMeeting.id, selectedMeeting.projectId, { checklist: nextChecklist }).catch(() => undefined);
  };

  const copyText = async (label: string, value: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      window.setTimeout(() => setCopiedField((current) => (current === label ? null : current)), 1400);
    } catch {
      setCopiedField(null);
    }
  };

  const enhanceMeetingMinutes = async () => {
    if (!selectedMeeting || !minutesDraft.trim()) {
      setMinutesAiError('Add rough meeting notes first, then organize them with AI.');
      return;
    }

    setMinutesAiError('');
    setIsEnhancingMinutes(true);
    try {
      const enhanced = await geminiService.enhanceMeetingNotes({
        meetingTitle: selectedMeeting.title,
        course: selectedMeeting.course,
        projectTitle: selectedMeeting.projectTitle,
        agenda: selectedMeeting.agenda || selectedMeeting.notes || '',
        rawNotes: minutesDraft,
        participantEmails: selectedMeeting.participantEmails || [],
      });

      await patchMeeting(selectedMeeting.id, selectedMeeting.projectId, {
        aiExecutiveSummary: enhanced.executiveSummary,
        aiStructuredNotes: enhanced.structuredNotes,
        aiKeyTakeaways: enhanced.keyTakeaways,
        aiDecisions: enhanced.decisions,
        aiActionItems: enhanced.actionItems,
        aiBlockers: enhanced.blockers,
        aiFollowUpEmail: enhanced.followUpEmail,
        aiGeneratedAt: new Date().toISOString(),
      });

      if (!decisionsDraft.trim() && enhanced.decisions.length) {
        setDecisionsDraft(enhanced.decisions.map((item) => `- ${item}`).join('\n'));
      }
    } catch (error) {
      setMinutesAiError(error instanceof Error ? error.message : 'Meeting AI could not organize these notes.');
    } finally {
      setIsEnhancingMinutes(false);
    }
  };

  const appendAiActionItemsToChecklist = async () => {
    if (!selectedMeeting?.aiActionItems?.length) return;

    const existing = new Set((selectedMeeting.checklist || []).map((item) => item.text.trim().toLowerCase()));
    const additional = selectedMeeting.aiActionItems
      .map((item, index) => ({
        id: `check-ai-${Date.now()}-${index}`,
        text: `${item.task}${item.owner && item.owner !== 'Unassigned' ? ` (${item.owner})` : ''}${item.deadline && item.deadline !== 'Not set' ? ` · ${item.deadline}` : ''}`,
        done: false,
      }))
      .filter((item) => !existing.has(item.text.trim().toLowerCase()));

    if (!additional.length) return;

    await patchMeeting(selectedMeeting.id, selectedMeeting.projectId, {
      checklist: [...(selectedMeeting.checklist || []), ...additional],
    });
  };

  const endSelectedMeeting = async () => {
    if (!selectedMeeting) return;

    const endedAt = new Date().toISOString();
    await patchMeeting(selectedMeeting.id, selectedMeeting.projectId, {
      status: 'ended',
      endedAt,
    });

    if (activeMeeting?.meetingId === selectedMeeting.id) {
      clearActiveUniversityMeeting();
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[36px] border border-white/60 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.8))] p-8 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-600">Meeting Room</p>
            <h1 className="text-4xl font-black tracking-tight text-zinc-950">Run your live study rooms from one place.</h1>
            <p className="max-w-3xl text-lg leading-8 text-zinc-600">
              Join Jitsi study rooms, keep scheduled meetings visible, and stay aware of meetings about to begin.
            </p>
            {!jitsiProvisioned ? (
              <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-7 text-amber-900">
                {getUniversityJitsiProvisioningMessage()}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
              {meetings.length} meetings tracked
            </div>
            <div className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-700">
              {upcomingSoonMeetings.length} starting soon
            </div>
          </div>
        </div>
      </div>

      {!!upcomingSoonMeetings.length && (
        <div className="rounded-[28px] border border-amber-200 bg-amber-50/90 p-5 shadow-[0_16px_40px_rgba(245,158,11,0.12)]">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-700" />
            <h2 className="text-xl font-black text-zinc-950">Starting within 2 minutes</h2>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {upcomingSoonMeetings.map((meeting) => {
              const countdown = getMeetingCountdown(meeting.when);
              return (
                <div key={meeting.id} className="rounded-[18px] border border-amber-200 bg-white px-4 py-4">
                  <p className="font-black text-zinc-900">{meeting.title}</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-500">{meeting.projectTitle}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                      {countdown?.label || 'Starting soon'}
                    </span>
                    <button
                      onClick={() => setSelectedMeetingId(meeting.id)}
                      className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-800"
                    >
                      Open
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-[30px] border border-white/60 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-black text-zinc-950">Meeting cards</h2>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          {meetings.map((meeting) => {
            const countdown = getMeetingCountdown(meeting.when);
            const isSelected = meeting.id === selectedMeeting?.id;
            return (
              <button
                key={meeting.id}
                onClick={() => setSelectedMeetingId(meeting.id)}
                className={cn(
                  'rounded-[22px] border px-4 py-4 text-left transition',
                  isSelected ? 'border-slate-300 bg-slate-50 shadow-sm' : 'border-zinc-200 bg-white hover:border-zinc-300',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-zinc-900">{meeting.title}</p>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                      meeting.provider === 'jitsi' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700',
                    )}
                  >
                    {meeting.provider}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-zinc-500">{meeting.projectTitle}</p>
                <p className="mt-2 text-sm text-zinc-600">{meeting.when ? new Date(meeting.when).toLocaleString() : 'Time not set'}</p>
                {countdown && (
                  <p className={cn('mt-2 text-xs font-black uppercase tracking-[0.16em]', countdown.isSoon ? 'text-amber-700' : 'text-zinc-400')}>
                    {countdown.label}
                  </p>
                )}
              </button>
            );
          })}
          {!meetings.length && (
            <div className="rounded-[22px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500 xl:col-span-3">
              No meetings saved yet. Create one from Teamwork and it will appear here.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[30px] border border-white/60 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        {selectedMeeting ? (
          <div className="space-y-6">
            <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
              <div className="space-y-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">
                    {selectedMeeting.course || 'Team room'}
                  </p>
                  <h2 className="mt-1 text-3xl font-black tracking-tight text-zinc-950">
                    {selectedMeeting.title}
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-zinc-500">{selectedMeeting.projectTitle}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {selectedMeeting.provider === 'jitsi' && selectedMeetingUrl && jitsiProvisioned ? (
                    <button
                      onClick={() =>
                        window.localStorage &&
                        window.dispatchEvent(
                          new CustomEvent('edurev-open-meeting', {
                            detail: {
                              meetingId: selectedMeeting.id,
                            },
                          }),
                        )
                      }
                      className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-black text-zinc-700 transition hover:border-zinc-300"
                    >
                      Keep active in-app
                    </button>
                  ) : null}
                  {selectedMeetingUrl ? (
                    <a
                      href={selectedMeetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-800"
                    >
                      <ExternalLink size={15} />
                      Open externally
                    </a>
                  ) : null}
                  {activeMeeting?.meetingId === selectedMeeting.id ? (
                    <button
                      onClick={() => {
                        endSelectedMeeting().catch(() => undefined);
                      }}
                      className="rounded-full bg-rose-50 px-4 py-2 text-sm font-black text-rose-600 transition hover:bg-rose-100"
                    >
                      End active room
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[20px] border border-zinc-200 bg-zinc-50/80 px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Room mode</p>
                    <p className="mt-2 text-base font-black text-zinc-950">
                      {selectedMeeting.provider === 'jitsi' ? 'In-app study room' : 'External meeting'}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      {activeMeeting?.meetingId === selectedMeeting.id
                        ? 'Active in your workspace.'
                        : 'Ready to join when the session starts.'}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-zinc-200 bg-zinc-50/80 px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Meeting time</p>
                    <p className="mt-2 text-base font-black text-zinc-950 break-words">
                      {selectedMeeting.when ? new Date(selectedMeeting.when).toLocaleString() : 'Time not set'}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-zinc-200 bg-zinc-50/80 px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Status</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {selectedMeeting.status === 'ended' ? (
                        <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-zinc-700">
                          Ended
                        </span>
                      ) : getMeetingCountdown(selectedMeeting.when) ? (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                          {getMeetingCountdown(selectedMeeting.when)?.label}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                          Scheduled
                        </span>
                      )}
                      {activeMeeting?.meetingId === selectedMeeting.id ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                          Live in workspace
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-1 text-sm font-semibold text-zinc-600">
                      {selectedMeeting.startedAt ? (
                        <p>
                          Start:{' '}
                          <span className="font-black text-zinc-900">
                            {new Date(selectedMeeting.startedAt).toLocaleString()}
                          </span>
                        </p>
                      ) : null}
                      {selectedMeeting.endedAt ? (
                        <p>
                          End:{' '}
                          <span className="font-black text-zinc-900">
                            {new Date(selectedMeeting.endedAt).toLocaleString()}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
              <div className="min-w-0 space-y-6">
                <div className="w-full rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                  {selectedMeeting.provider === 'jitsi' && selectedMeeting.roomName && jitsiProvisioned ? (
                    <EmbeddedJitsiRoom
                      roomName={selectedMeeting.roomName}
                      displayName={currentUser?.displayName || currentUser?.email?.split('@')[0] || 'University student'}
                      email={currentUser?.email || undefined}
                      meetingTitle={selectedMeeting.title}
                      moderator={selectedMeeting.createdBy === currentUser?.uid}
                      className="block h-[68vh] min-h-[560px] w-full max-w-none rounded-[26px] shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
                    />
                  ) : selectedMeeting.provider === 'jitsi' && !jitsiProvisioned ? (
                    <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-10 text-center">
                      <AlertCircle className="mx-auto h-8 w-8 text-amber-700" />
                      <p className="mt-4 text-lg font-black text-zinc-900">In-app meeting unavailable.</p>
                      <p className="mt-2 text-sm leading-7 text-zinc-600">
                        This meeting room is not available right now. Open the external room option or start a fresh university meeting from Teamwork.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
                      <Video className="mx-auto h-8 w-8 text-zinc-300" />
                      <p className="mt-4 text-lg font-black text-zinc-900">This meeting uses an external room.</p>
                      <p className="mt-2 text-sm text-zinc-500">Use the launch button above to open the meeting link.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-600" />
                    <h3 className="text-lg font-black text-zinc-950">Participants</h3>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(selectedMeeting.participantEmails || []).length ? (
                      (selectedMeeting.participantEmails || []).map((email) => (
                        <div key={email} className="rounded-[14px] border border-zinc-200 bg-white px-3 py-3 text-sm font-semibold text-zinc-700">
                          {email}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[14px] border border-dashed border-zinc-200 bg-white px-3 py-4 text-sm text-zinc-500">
                        Participants were not specified for this room.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-lg font-black text-zinc-950">Decisions and actions</h3>
                  </div>
                  <textarea
                    value={decisionsDraft}
                    onChange={(event) => setDecisionsDraft(event.target.value)}
                    className="mt-3 min-h-[220px] w-full rounded-[16px] border border-zinc-200 bg-white px-4 py-4 text-sm leading-6 text-zinc-800 outline-none focus:border-indigo-400"
                    placeholder="Capture confirmed decisions, owners, deadlines, and unresolved items."
                  />
                </div>
              </div>
            </div>

            <div className="w-full overflow-hidden rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <div className="border-b border-zinc-200 px-6 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-slate-700" />
                      <h3 className="text-2xl font-black tracking-tight text-zinc-950">Meeting minutes</h3>
                    </div>
                    <p className="max-w-4xl text-sm leading-7 text-zinc-600">
                      Capture rough live notes as the meeting unfolds, then let AI transform them into clean university-grade minutes, decisions, action items, and a follow-up recap.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-700">
                      Live notes
                    </span>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-indigo-700">
                      Auto-saving
                    </span>
                    <button
                      onClick={enhanceMeetingMinutes}
                      disabled={isEnhancingMinutes}
                      className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isEnhancingMinutes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {isEnhancingMinutes ? 'Organizing…' : 'Transform my notes'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-[18px] border border-zinc-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Agenda focus</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">
                      {selectedMeeting.agenda || selectedMeeting.notes || 'No agenda saved yet.'}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-zinc-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Project</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-800">{selectedMeeting.projectTitle}</p>
                    <p className="mt-1 text-sm text-zinc-500">{selectedMeeting.course || 'Course not set'}</p>
                  </div>
                  <div className="rounded-[18px] border border-zinc-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Suggested structure</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">
                      Summary, evidence, blockers, decisions, owners, deadlines, and a follow-up recap.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 px-6 py-5">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Raw capture</p>
                          <h4 className="mt-1 text-lg font-black text-zinc-950">Live transcript notes</h4>
                        </div>
                        <button
                          onClick={() => copyText('raw-notes', minutesDraft)}
                          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-600 transition hover:border-zinc-300"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copiedField === 'raw-notes' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <textarea
                        value={minutesDraft}
                        onChange={(event) => setMinutesDraft(event.target.value)}
                        className="mt-4 min-h-[340px] w-full rounded-[20px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff,#fafafa)] px-5 py-5 text-[15px] leading-8 text-zinc-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                        placeholder="Type rough notes exactly as the meeting happens: context, evidence raised, disagreements, blockers, decisions, numbers, owners, and follow-up."
                      />
                    </div>

                    <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-4">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-5 w-5 text-fuchsia-600" />
                        <h3 className="text-lg font-black text-zinc-950">Checklist</h3>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          value={checklistInput}
                          onChange={(event) => setChecklistInput(event.target.value)}
                          className="flex-1 rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 outline-none focus:border-indigo-400"
                          placeholder="Add a live action item"
                        />
                        <button
                          onClick={addChecklistItem}
                          className="rounded-full bg-zinc-950 px-3 text-sm font-black text-white transition hover:bg-zinc-800"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="mt-3 max-h-[260px] space-y-2 overflow-y-auto pr-1">
                        {(selectedMeeting.checklist || []).length ? (
                          (selectedMeeting.checklist || []).map((item) => (
                            <div key={item.id} className="flex items-center gap-3 rounded-[14px] border border-zinc-200 bg-white px-3 py-3">
                              <button
                                type="button"
                                onClick={() => toggleChecklistItem(item.id)}
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
                                onClick={() => removeChecklistItem(item.id)}
                                className="rounded-full bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[14px] border border-dashed border-zinc-200 bg-white px-3 py-4 text-sm text-zinc-500">
                            No checklist yet. Add the actions your team needs to work through live.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-zinc-200 bg-[linear-gradient(180deg,#fcfcfd,#f8fafc)] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">AI workspace</p>
                          <h4 className="mt-1 text-lg font-black text-zinc-950">Organized meeting output</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => copyText('follow-up-email', selectedMeeting.aiFollowUpEmail || '')}
                            disabled={!selectedMeeting.aiFollowUpEmail}
                            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-600 transition hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {copiedField === 'follow-up-email' ? 'Copied' : 'Copy recap'}
                          </button>
                          <button
                            onClick={appendAiActionItemsToChecklist}
                            disabled={!selectedMeeting.aiActionItems?.length}
                            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <CheckSquare className="h-3.5 w-3.5" />
                            Push actions to checklist
                          </button>
                        </div>
                      </div>

                      {minutesAiError ? (
                        <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                          {minutesAiError}
                        </div>
                      ) : null}

                      <div className="mt-4 rounded-[18px] border border-zinc-200 bg-white px-4 py-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Executive summary</p>
                        <p className="mt-2 text-sm leading-7 text-zinc-700">
                          {selectedMeeting.aiExecutiveSummary || 'Use Transform my notes to generate a concise project-ready summary of the conversation.'}
                        </p>
                      </div>

                      <div className="mt-4 rounded-[18px] border border-zinc-200 bg-white px-4 py-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Structured notes</p>
                        <div className="mt-3 max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded-[16px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-7 text-zinc-700">
                          {selectedMeeting.aiStructuredNotes || 'Once AI organizes the meeting, the cleaned-up discussion summary, evidence, rationale, and next-step narrative will appear here.'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-[18px] border border-zinc-200 bg-white px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Key takeaways</p>
                    {(selectedMeeting.aiKeyTakeaways || []).length ? (
                      <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-700">
                        {selectedMeeting.aiKeyTakeaways?.map((item, index) => (
                          <li key={`${item}-${index}`} className="flex gap-2">
                            <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-indigo-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm leading-7 text-zinc-500">
                        Important points, evidence, and themes from the meeting will appear here.
                      </p>
                    )}
                  </div>
                  <div className="rounded-[18px] border border-zinc-200 bg-white px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Blockers</p>
                    {(selectedMeeting.aiBlockers || []).length ? (
                      <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-700">
                        {selectedMeeting.aiBlockers?.map((item, index) => (
                          <li key={`${item}-${index}`} className="flex gap-2">
                            <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm leading-7 text-zinc-500">
                        Risks, blockers, and unresolved dependencies will appear here after AI organization.
                      </p>
                    )}
                  </div>
                  <div className="rounded-[18px] border border-zinc-200 bg-white px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Action items</p>
                    {(selectedMeeting.aiActionItems || []).length ? (
                      <div className="mt-3 space-y-3">
                        {selectedMeeting.aiActionItems?.map((item, index) => (
                          <div key={`${item.task}-${index}`} className="rounded-[16px] border border-zinc-200 bg-zinc-50 px-3 py-3">
                            <p className="text-sm font-black text-zinc-900">{item.task}</p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                              {item.owner || 'Unassigned'}
                              {item.deadline ? ` · ${item.deadline}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm leading-7 text-zinc-500">
                        Owners and deadlines will be summarized here after AI review.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-[18px] border border-zinc-200 bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Follow-up email</p>
                    <button
                      onClick={() => copyText('follow-up-email-panel', selectedMeeting.aiFollowUpEmail || '')}
                      disabled={!selectedMeeting.aiFollowUpEmail}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-600 transition hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedField === 'follow-up-email-panel' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="mt-3 whitespace-pre-wrap rounded-[16px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-7 text-zinc-700">
                    {selectedMeeting.aiFollowUpEmail || 'A concise meeting recap email for the team will appear here after AI processing.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-zinc-300" />
            <p className="mt-4 text-lg font-black text-zinc-900">No meeting selected</p>
            <p className="mt-2 text-sm text-zinc-500">Create or schedule meetings from Teamwork and they will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
