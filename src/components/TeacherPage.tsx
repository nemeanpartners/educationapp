import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  MailPlus,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from '@/lib/portal-firestore';
import { auth, db } from '../firebase';
import { cn } from '../lib/utils';
import {
  normalizeTeacherTicket,
  flattenTeacherProfiles,
  readLocalTeacherTickets,
  readLocalTeacherProfiles,
  normalizeTeacherProfiles,
  TeacherClass,
  TeacherTicket,
  ticketTags,
  writeLocalTeacherTickets,
} from '../lib/teacher-tickets';
import { useResponsiveDevice } from '../hooks/use-responsive-device';

export default function TeacherPage() {
  const { isPhone } = useResponsiveDevice();
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [availableClasses, setAvailableClasses] = useState<TeacherClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null);
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [selectedTag, setSelectedTag] = useState(ticketTags[0]);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TeacherTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedClassFilter, setSelectedClassFilter] = useState('All');
  const [ticketSearch, setTicketSearch] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [replyStatusMessage, setReplyStatusMessage] = useState('');

  useEffect(() => {
    const profilesQuery = query(collection(db, 'teacherProfiles'));
    const unsubscribe = onSnapshot(profilesQuery, (snapshot) => {
      const profiles = normalizeTeacherProfiles(snapshot.docs.map((profileDoc) => ({
        id: profileDoc.id,
        data: profileDoc.data(),
      })));
      const classes = flattenTeacherProfiles(profiles);
      setAvailableClasses(classes);
      setSelectedClass((currentClass) => currentClass && classes.some((classItem) => classItem.id === currentClass.id)
        ? currentClass
        : classes[0] || null);
    }, (error) => {
      console.error('Could not load teacher setup profiles:', error);
      const classes = flattenTeacherProfiles(readLocalTeacherProfiles());
      setAvailableClasses(classes);
      setSelectedClass((currentClass) => currentClass && classes.some((classItem) => classItem.id === currentClass.id)
        ? currentClass
        : classes[0] || null);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setTickets(readLocalTeacherTickets());
      return;
    }

    const ticketsQuery = query(
      collection(db, 'teacherTickets'),
      where('userId', '==', userId),
      orderBy('sentAt', 'desc'),
    );

    const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      const loadedTickets = snapshot.docs.map((doc) => normalizeTeacherTicket(doc.id, doc.data()));
      setTickets(loadedTickets);
      setSelectedTicketId((currentId) => currentId && loadedTickets.some((ticket) => ticket.id === currentId)
        ? currentId
        : loadedTickets[0]?.id || null);
    }, (error) => {
      console.error('Could not load teacher tickets from Firestore:', error);
      const localTickets = readLocalTeacherTickets().filter((ticket) => !ticket.userId || ticket.userId === userId);
      setTickets(localTickets);
      setSelectedTicketId(localTickets[0]?.id || null);
    });

    return () => unsubscribe();
  }, []);

  const openTicket = (classItem = selectedClass) => {
    if (!classItem) return;
    setSelectedClass(classItem);
    setTicketSubject(`${classItem.subject} question`);
    setTicketMessage('');
    setSelectedTag(ticketTags[0]);
    setSentMessage(null);
    setIsTicketOpen(true);
  };

  const sendTicket = async () => {
    if (!selectedClass) return;
    const currentUser = auth.currentUser;
    const ticket: TeacherTicket = {
      id: `ticket-${Date.now()}`,
      userId: currentUser?.uid || '',
      studentName: currentUser?.displayName || 'Student',
      studentEmail: currentUser?.email || '',
      subject: ticketSubject.trim(),
      message: ticketMessage.trim(),
      tag: selectedTag,
      teacher: selectedClass.teacher,
      classSubject: selectedClass.subject,
      sentAt: new Date().toISOString(),
      status: 'open',
      replies: [],
    };

    const localTickets = [ticket, ...readLocalTeacherTickets()].slice(0, 50);
    writeLocalTeacherTickets(localTickets);
    setTickets((currentTickets) => [ticket, ...currentTickets]);
    setSelectedTicketId(ticket.id);

    if (currentUser) {
      try {
        await addDoc(collection(db, 'teacherTickets'), {
          userId: currentUser.uid,
          studentName: currentUser.displayName || 'Student',
          studentEmail: currentUser.email || '',
          subject: ticket.subject,
          message: ticket.message,
          tag: ticket.tag,
          teacher: ticket.teacher,
          classSubject: ticket.classSubject,
          sentAt: ticket.sentAt,
          status: ticket.status,
          replies: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error('Could not save teacher ticket to Firestore:', error);
      }
    }

    setSentMessage(`Ticket sent to ${selectedClass.teacher}.`);
    setTicketSubject('');
    setTicketMessage('');
  };

  const formatTicketDate = (date: string) => new Date(date).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  const classFilters = useMemo(() => ['All', ...Array.from(new Set(availableClasses.map((classItem) => classItem.subject)))], [availableClasses]);
  const filteredTickets = useMemo(() => {
    const search = ticketSearch.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesClass = selectedClassFilter === 'All' || ticket.classSubject === selectedClassFilter;
      const matchesSearch = !search ||
        ticket.teacher.toLowerCase().includes(search) ||
        ticket.classSubject.toLowerCase().includes(search) ||
        ticket.subject.toLowerCase().includes(search) ||
        ticket.message.toLowerCase().includes(search);

      return matchesClass && matchesSearch;
    });
  }, [selectedClassFilter, ticketSearch, tickets]);
  const selectedTicket = filteredTickets.find((ticket) => ticket.id === selectedTicketId) || filteredTickets[0] || null;
  const ticketsByClass = useMemo(() => (
    filteredTickets.reduce<Record<string, TeacherTicket[]>>((groups, ticket) => {
      const key = ticket.classSubject || 'General';
      groups[key] = groups[key] || [];
      groups[key].push(ticket);
      return groups;
    }, {})
  ), [filteredTickets]);

  const updateTicketLocally = (updatedTicket: TeacherTicket) => {
    setTickets((currentTickets) => currentTickets.map((ticket) => ticket.id === updatedTicket.id ? updatedTicket : ticket));
    const storedTickets = readLocalTeacherTickets();
    const existsLocally = storedTickets.some((ticket) => ticket.id === updatedTicket.id);
    writeLocalTeacherTickets(existsLocally
      ? storedTickets.map((ticket) => ticket.id === updatedTicket.id ? updatedTicket : ticket)
      : [updatedTicket, ...storedTickets]);
  };

  const sendStudentReply = async () => {
    if (!selectedTicket || !replyDraft.trim() || selectedTicket.status === 'closed') return;

    const currentUser = auth.currentUser;
    const reply = {
      message: replyDraft.trim(),
      teacherName: currentUser?.displayName || 'Student',
      repliedAt: new Date().toISOString(),
      senderRole: 'student' as const,
      senderName: currentUser?.displayName || selectedTicket.studentName || 'Student',
    };
    const updatedTicket: TeacherTicket = {
      ...selectedTicket,
      status: 'open',
      replies: [...selectedTicket.replies, reply],
    };

    updateTicketLocally(updatedTicket);
    setReplyDraft('');
    setReplyStatusMessage('Reply sent.');

    try {
      await updateDoc(doc(db, 'teacherTickets', selectedTicket.id), {
        status: 'open',
        replies: updatedTicket.replies,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Could not save student ticket reply:', error);
      setReplyStatusMessage('Reply saved locally. Firestore sync failed.');
    }
  };

  useEffect(() => {
    if (!isPhone || !replyTextareaRef.current) return;
    const nextHeight = Math.min(140, Math.max(44, replyTextareaRef.current.scrollHeight));
    replyTextareaRef.current.style.height = '44px';
    replyTextareaRef.current.style.height = `${nextHeight}px`;
  }, [replyDraft, isPhone]);

  return (
    <div className={cn("min-h-[calc(100vh-100px)] space-y-8 bg-zinc-50", isPhone ? "p-4" : "p-6")}>
      <header className={cn(
        "flex flex-col gap-4 rounded-[32px] border border-zinc-200 bg-white shadow-sm md:flex-row md:items-center md:justify-between",
        isPhone ? "rounded-[28px] p-4" : "p-6"
      )}>
        <div>
          <div className={cn("mb-3 flex items-center justify-center rounded-2xl bg-indigo-600 text-white", isPhone ? "h-10 w-10" : "h-12 w-12")}>
            <GraduationCap size={isPhone ? 20 : 24} />
          </div>
          <h1 className={cn("font-black tracking-tight text-zinc-900", isPhone ? "text-2xl" : "text-3xl")}>Teachers</h1>
          <p className={cn("mt-1 max-w-2xl font-medium text-zinc-500", isPhone ? "text-xs leading-5" : "text-sm")}>
            Send tickets to your teachers and track their replies from one place.
          </p>
        </div>
        <button
          onClick={() => openTicket()}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 font-black text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700",
            isPhone ? "w-full px-4 py-3 text-sm" : "px-5 py-3 text-sm"
          )}
        >
          <MailPlus size={18} />
          Send Ticket
        </button>
      </header>

      <section className={cn("grid grid-cols-1", isPhone ? "gap-3" : "gap-5 md:grid-cols-2 xl:grid-cols-4")}>
        {availableClasses.map((classItem) => (
          <motion.button
            key={classItem.id}
            whileHover={{ y: -3 }}
            onClick={() => openTicket(classItem)}
            className={cn(
              'rounded-3xl border text-left shadow-sm transition-all hover:shadow-md',
              isPhone ? 'rounded-[24px] p-4' : 'p-5',
              classItem.colour,
            )}
          >
            <div className={cn("flex items-start justify-between gap-3", isPhone ? "mb-4" : "mb-5")}>
              <div className={cn("flex items-center justify-center rounded-2xl bg-white/70", isPhone ? "h-10 w-10" : "h-11 w-11")}>
                <BookOpen size={isPhone ? 18 : 20} />
              </div>
              <span className={cn("rounded-full bg-white/70 font-black uppercase tracking-widest", isPhone ? "px-2.5 py-1 text-[9px]" : "px-3 py-1 text-[10px]")}>
                Teacher setup
              </span>
            </div>
            <h2 className={cn("font-black", isPhone ? "text-lg" : "text-xl")}>{classItem.subject}</h2>
            <div className={cn("space-y-2 font-bold", isPhone ? "mt-3 text-xs" : "mt-4 text-sm")}>
              <p className="flex items-center gap-2">
                <UserRound size={15} />
                {classItem.teacher}
              </p>
              <p className="text-xs opacity-80">{classItem.room} · {classItem.nextClass}</p>
            </div>
            <div className={cn("inline-flex items-center gap-2 font-black", isPhone ? "mt-4 text-xs" : "mt-5 text-sm")}>
              Send ticket <MessageSquare size={15} />
            </div>
          </motion.button>
        ))}
        {availableClasses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 bg-white p-6 text-center md:col-span-2 xl:col-span-4">
            <GraduationCap className="mx-auto mb-3 h-9 w-9 text-zinc-300" />
            <p className="text-lg font-black text-zinc-900">No teacher classes have been set up yet.</p>
            <p className="mt-2 text-sm font-semibold text-zinc-500">
              Teachers need to add their real name and classes in the Teacher Portal before students can send tickets.
            </p>
          </div>
        ) : null}
      </section>

      <section className={cn("rounded-[32px] border border-zinc-200 bg-white shadow-sm", isPhone ? "rounded-[28px] p-4" : "p-6")}>
        <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
          <Sparkles size={16} className="text-indigo-500" />
          Teacher Directory Preview
        </div>
        <div className={cn("grid grid-cols-1 gap-3", !isPhone && "md:grid-cols-2")}>
          {availableClasses.map((classItem) => (
            <div key={`directory-${classItem.id}`} className={cn("flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50", isPhone ? "p-3" : "p-4")}>
              <div>
                <p className={cn("font-black text-zinc-900", isPhone ? "text-sm" : "")}>{classItem.teacher}</p>
                <p className={cn("font-medium text-zinc-500", isPhone ? "text-xs" : "text-sm")}>{classItem.subject} · {classItem.room}</p>
              </div>
              <button
                onClick={() => openTicket(classItem)}
                className={cn("rounded-xl border border-zinc-200 bg-white font-black text-zinc-700 hover:border-indigo-300 hover:text-indigo-600", isPhone ? "px-3 py-2 text-[11px]" : "px-3 py-2 text-xs")}
              >
                Ticket
              </button>
            </div>
          ))}
          {availableClasses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm font-semibold text-zinc-500 md:col-span-2">
              Teacher directory is empty until a teacher completes setup.
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-sm">
        <div className={cn("grid grid-cols-1", isPhone ? "min-h-0" : "min-h-[620px] lg:grid-cols-[430px_1fr]")}>
          <aside className="flex min-h-0 flex-col border-b border-zinc-200 bg-white lg:border-b-0 lg:border-r">
            <div className={cn("shrink-0 border-b border-zinc-100", isPhone ? "p-4" : "p-6")}>
              <div className={cn("flex items-center justify-between gap-4", isPhone ? "mb-4" : "mb-5")}>
                <div className="flex items-center gap-3">
                  <h2 className={cn("font-black tracking-tight text-zinc-950", isPhone ? "text-2xl" : "text-4xl")}>Tickets</h2>
                  <span className={cn("rounded-full border border-indigo-200 bg-indigo-50 font-black text-indigo-700", isPhone ? "px-2.5 py-1 text-xs" : "px-3 py-1 text-sm")}>
                    {tickets.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openTicket()}
                  disabled={!selectedClass}
                  className={cn("flex items-center justify-center rounded-full bg-zinc-100 text-zinc-800 hover:bg-zinc-200", isPhone ? "h-10 w-10" : "h-12 w-12")}
                  aria-label="Start a new ticket"
                >
                  <MailPlus size={isPhone ? 18 : 20} />
                </button>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2">
                <select
                  value={selectedClassFilter}
                  onChange={(event) => {
                    const nextClass = event.target.value;
                    setSelectedClassFilter(nextClass);
                    const nextTicket = nextClass === 'All'
                      ? tickets[0]
                      : tickets.find((ticket) => ticket.classSubject === nextClass);
                    setSelectedTicketId(nextTicket?.id || null);
                  }}
                  className={cn("rounded-2xl border-none bg-zinc-100 font-black text-zinc-700 outline-none", isPhone ? "h-11 px-3 text-xs" : "h-12 px-4 text-sm")}
                >
                  {classFilters.map((className) => (
                    <option key={className} value={className}>{className === 'All' ? 'All Classes' : className}</option>
                  ))}
                </select>
                <select
                  className={cn("rounded-2xl border-none bg-zinc-100 font-black text-zinc-700 outline-none", isPhone ? "h-11 px-3 text-xs" : "h-12 px-4 text-sm")}
                  defaultValue="newest"
                >
                  <option value="newest">Newest First</option>
                </select>
              </div>

              <div className="relative">
                <Search className={cn("absolute top-1/2 -translate-y-1/2 text-zinc-400", isPhone ? "left-3 h-4 w-4" : "left-4 h-5 w-5")} />
                <input
                  value={ticketSearch}
                  onChange={(event) => setTicketSearch(event.target.value)}
                  placeholder="Search teacher, class, or ticket"
                  className={cn("w-full rounded-2xl border-none bg-zinc-100 font-semibold text-zinc-900 outline-none placeholder:text-zinc-400", isPhone ? "h-12 pl-10 pr-3 text-xs" : "h-14 pl-12 pr-4 text-sm")}
                />
              </div>
            </div>

            <div className={cn("min-h-0 flex-1 overflow-y-auto", isPhone ? "px-4 py-4" : "px-6 py-5")}>
              {filteredTickets.length > 0 ? (
                <div className="space-y-7">
                  {(Object.entries(ticketsByClass) as [string, TeacherTicket[]][]).map(([className, classTickets]) => (
                    <section key={className}>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">{className}</h3>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black text-zinc-500">{classTickets.length}</span>
                      </div>
                      <div className="space-y-1">
                        {classTickets.map((ticket) => {
                          const latestReply = ticket.replies[ticket.replies.length - 1];
                          const isSelected = selectedTicket?.id === ticket.id;

                          return (
                            <button
                              key={ticket.id}
                              type="button"
                              onClick={() => setSelectedTicketId(ticket.id)}
                              className={cn(
                                'w-full rounded-2xl px-1 py-3 text-left transition',
                                isSelected ? 'bg-cyan-50' : 'hover:bg-zinc-50',
                              )}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p className={cn("truncate font-black text-zinc-900", isPhone ? "text-sm" : "text-base")}>{ticket.teacher}</p>
                                  <p className={cn("mt-0.5 truncate font-bold text-zinc-500", isPhone ? "text-xs" : "text-sm")}>{ticket.subject}</p>
                                </div>
                                <span className={cn("shrink-0 font-bold text-zinc-400", isPhone ? "text-[10px]" : "text-xs")}>{formatTicketDate(ticket.sentAt)}</span>
                              </div>
                              <p className={cn("mt-2 truncate font-semibold text-zinc-500", isPhone ? "text-xs" : "text-sm")}>
                                {latestReply
                                  ? `${latestReply.senderRole === 'student' ? 'You' : ticket.teacher}: ${latestReply.message}`
                                  : `You: ${ticket.message}`}
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="w-fit rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-black text-zinc-500">
                                  {ticket.classSubject}
                                </span>
                                <span className={cn(
                                  'w-fit rounded-full px-2.5 py-1 text-[11px] font-black capitalize',
                                  ticket.status === 'open' ? 'bg-amber-100 text-amber-700' :
                                    ticket.status === 'replied' ? 'bg-emerald-100 text-emerald-700' :
                                      'bg-zinc-200 text-zinc-600',
                                )}>
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
                  <p className="text-lg font-black text-zinc-900">No ticket conversations</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-500">Send a ticket above to start a teacher chat.</p>
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-[520px] min-w-0 flex-col bg-white">
            {selectedTicket ? (
              <>
                <header className={cn("shrink-0 border-b border-zinc-100", isPhone ? "px-4 py-4" : "flex h-24 items-center justify-between px-8")}>
                  <div className={cn(isPhone ? "space-y-3" : "min-w-0")}>
                    <div className="mb-1 flex items-center gap-2 flex-wrap">
                      <span className={cn("rounded-full bg-indigo-50 font-black text-indigo-700", isPhone ? "px-2.5 py-1 text-[10px]" : "px-2.5 py-1 text-[11px]")}>{selectedTicket.classSubject}</span>
                      <span className={cn(
                        'rounded-full font-black capitalize',
                        isPhone ? 'px-2.5 py-1 text-[10px]' : 'px-2.5 py-1 text-[11px]',
                        selectedTicket.status === 'open' ? 'bg-amber-100 text-amber-700' :
                          selectedTicket.status === 'replied' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-zinc-200 text-zinc-600',
                      )}>{selectedTicket.status}</span>
                    </div>
                    <h3 className={cn("truncate font-black text-zinc-950", isPhone ? "text-3xl leading-tight" : "text-2xl")}>{selectedTicket.teacher}</h3>
                    <p className={cn("truncate font-semibold text-zinc-500", isPhone ? "text-xs" : "text-sm")}>{selectedTicket.subject}</p>
                    {isPhone ? (
                      <button
                        type="button"
                        onClick={() => openTicket(availableClasses.find((classItem) => classItem.subject === selectedTicket.classSubject) || selectedClass)}
                        disabled={!selectedClass}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-600 hover:bg-zinc-50"
                      >
                        New Ticket
                      </button>
                    ) : null}
                  </div>
                  {!isPhone ? (
                    <button
                      type="button"
                      onClick={() => openTicket(availableClasses.find((classItem) => classItem.subject === selectedTicket.classSubject) || selectedClass)}
                      disabled={!selectedClass}
                      className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-600 hover:bg-zinc-50"
                    >
                      New Ticket
                    </button>
                  ) : null}
                </header>

                <div className={cn("min-h-0 flex-1 overflow-y-auto bg-zinc-50/50", isPhone ? "px-4 py-4" : "px-8 py-8")}>
                  <div className={cn("mx-auto space-y-5", isPhone ? "max-w-none" : "max-w-3xl")}>
                    <div className="flex justify-end">
                      <div className={cn("rounded-[28px] rounded-tr-md bg-cyan-700 text-white shadow-lg shadow-cyan-100", isPhone ? "max-w-[88%] p-4" : "max-w-[78%] p-5")}>
                        <p className={cn("mb-2 font-black uppercase tracking-widest text-cyan-100", isPhone ? "text-[9px]" : "text-[10px]")}>
                          {selectedTicket.tag} · {formatTicketDate(selectedTicket.sentAt)}
                        </p>
                        <p className={cn("font-semibold whitespace-pre-wrap break-words", isPhone ? "text-sm leading-6" : "text-sm leading-7")}>
                          {selectedTicket.message}
                        </p>
                      </div>
                    </div>

                    {selectedTicket.replies.map((reply, index) => {
                      const isStudentReply = reply.senderRole === 'student';
                      return (
                        <div key={`${selectedTicket.id}-chat-reply-${index}`} className={isStudentReply ? 'flex justify-end' : 'flex justify-start'}>
                          <div className={cn(
                            'rounded-[28px] shadow-sm',
                            isPhone ? 'max-w-[88%] p-4' : 'max-w-[78%] p-5',
                            isStudentReply
                              ? 'rounded-tr-md bg-cyan-700 text-white shadow-lg shadow-cyan-100'
                              : 'rounded-tl-md bg-white text-zinc-700 ring-1 ring-zinc-100',
                          )}>
                            <div className={cn(
                              'mb-2 flex items-center gap-2 font-black uppercase tracking-widest',
                              isPhone ? 'text-[9px]' : 'text-[10px]',
                              isStudentReply ? 'text-cyan-100' : 'text-emerald-700',
                            )}>
                              {!isStudentReply && <CheckCircle2 size={13} />}
                              {isStudentReply ? 'You' : reply.senderName}
                            </div>
                            <p className={cn("font-semibold whitespace-pre-wrap break-words", isPhone ? "text-sm leading-6" : "text-sm leading-7")}>
                              {reply.message}
                            </p>
                            <p className={cn(
                              'mt-2 font-black uppercase tracking-widest',
                              isPhone ? 'text-[9px]' : 'text-[10px]',
                              isStudentReply ? 'text-cyan-100' : 'text-zinc-400',
                            )}>
                              {formatTicketDate(reply.repliedAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <footer className={cn("shrink-0 border-t border-zinc-100 bg-white", isPhone ? "p-4" : "p-6")}>
                  <div className={cn("mx-auto gap-3", isPhone ? "max-w-none" : "flex max-w-3xl items-end")}>
                    {isPhone ? (
                      <div className="flex items-end gap-2 rounded-[24px] border border-zinc-200 bg-white px-3 py-2 shadow-sm">
                        <textarea
                          ref={replyTextareaRef}
                          value={replyDraft}
                          onChange={(event) => setReplyDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              sendStudentReply();
                            }
                          }}
                          disabled={selectedTicket.status === 'closed'}
                          placeholder={selectedTicket.status === 'closed' ? 'This ticket is closed' : 'iMessage-style reply...'}
                          rows={1}
                          className="min-h-[44px] max-h-[140px] flex-1 resize-none border-none bg-transparent px-1 py-2 text-[16px] font-medium leading-6 text-zinc-800 outline-none placeholder:text-zinc-400 disabled:text-zinc-400"
                        />
                        <button
                          type="button"
                          onClick={sendStudentReply}
                          disabled={!replyDraft.trim() || selectedTicket.status === 'closed'}
                          className="inline-flex h-11 min-w-[64px] items-center justify-center rounded-full bg-cyan-700 px-4 text-sm font-black text-white shadow-md shadow-cyan-100 hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
                        >
                          Send
                        </button>
                      </div>
                    ) : (
                      <div className="flex max-w-3xl items-end gap-3">
                        <input
                          value={replyDraft}
                          onChange={(event) => setReplyDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              sendStudentReply();
                            }
                          }}
                          disabled={selectedTicket.status === 'closed'}
                          placeholder={selectedTicket.status === 'closed' ? 'This ticket is closed' : 'Write a reply...'}
                          className="h-14 flex-1 rounded-2xl border-2 border-zinc-100 bg-zinc-50 px-5 text-sm font-semibold text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-cyan-300 focus:bg-white disabled:text-zinc-400"
                        />
                        <button
                          type="button"
                          onClick={sendStudentReply}
                          disabled={!replyDraft.trim() || selectedTicket.status === 'closed'}
                          className="h-14 rounded-2xl bg-cyan-700 px-7 text-sm font-black text-white shadow-lg shadow-cyan-100 hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
                        >
                          Reply
                        </button>
                      </div>
                    )}
                  </div>
                  {replyStatusMessage ? (
                    <p className={cn("mx-auto mt-2 font-bold text-emerald-600", isPhone ? "max-w-none text-[11px]" : "max-w-3xl text-xs")}>{replyStatusMessage}</p>
                  ) : null}
                </footer>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <div className="relative mb-8 flex h-32 w-32 items-center justify-center rounded-[36px] bg-white shadow-2xl shadow-zinc-200">
                  <MessageSquare className="h-14 w-14 text-indigo-600" />
                </div>
                <h3 className="text-3xl font-black text-zinc-950">Your Inbox is Ready</h3>
                <p className="mt-5 max-w-xl text-xl font-medium leading-9 text-zinc-500">
                  Select a ticket conversation on the left to view messages from your teacher.
                </p>
                <button
                  type="button"
                  onClick={() => openTicket()}
                  disabled={!selectedClass}
                  className="mt-10 h-14 rounded-2xl bg-indigo-600 px-9 text-base font-black text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700"
                >
                  Start New Ticket
                </button>
              </div>
            )}
          </section>
        </div>
      </section>

      <AnimatePresence>
        {isTicketOpen && selectedClass && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className={cn("w-full rounded-[32px] border border-zinc-200 bg-white shadow-2xl", isPhone ? "max-w-none rounded-[28px] p-4" : "max-w-2xl p-6")}
            >
              <div className={cn("flex items-start justify-between gap-4", isPhone ? "mb-4" : "mb-6")}>
                <div>
                  <h3 className={cn("font-black tracking-tight text-zinc-900", isPhone ? "text-xl" : "text-2xl")}>Send Ticket</h3>
                  <p className={cn("mt-1 font-medium text-zinc-500", isPhone ? "text-xs" : "text-sm")}>
                    To {selectedClass.teacher} for {selectedClass.subject}
                  </p>
                </div>
                <button
                  onClick={() => setIsTicketOpen(false)}
                  className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <X size={20} />
                </button>
              </div>

              <div className={cn("space-y-5", isPhone && "space-y-4")}>
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-400">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {ticketTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSelectedTag(tag)}
                        className={cn(
                          'rounded-full border font-black transition-all',
                          isPhone ? 'px-3 py-2 text-[11px]' : 'px-3 py-2 text-xs',
                          selectedTag === tag
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:border-indigo-300 hover:text-indigo-600',
                        )}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-400">Subject</label>
                  <input
                    value={ticketSubject}
                    onChange={(event) => setTicketSubject(event.target.value)}
                    placeholder="What is this about?"
                    className={cn("w-full rounded-2xl border border-zinc-200 bg-zinc-50 font-semibold outline-none focus:border-indigo-400 focus:bg-white", isPhone ? "px-4 py-3 text-sm" : "px-4 py-3 text-sm")}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-400">Message</label>
                  <textarea
                    value={ticketMessage}
                    onChange={(event) => setTicketMessage(event.target.value)}
                    placeholder="Write what you want to send to your teacher..."
                    rows={isPhone ? 5 : 6}
                    className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:bg-white"
                  />
                </div>

                {sentMessage ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                    {sentMessage}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => setIsTicketOpen(false)}
                    className={cn("rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-black text-zinc-600 hover:bg-zinc-50", isPhone && "w-full")}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendTicket}
                    disabled={!ticketSubject.trim() || !ticketMessage.trim()}
                    className={cn("inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none", isPhone && "w-full")}
                  >
                    <Send size={16} />
                    Send Ticket
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
