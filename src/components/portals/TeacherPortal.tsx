import React, { useMemo, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  Plus, 
  ChevronRight, 
  BarChart3, 
  CheckCircle2, 
  Clock,
  Sparkles,
  MessageSquare,
  FileText,
  Loader2,
  CheckCircle,
  Inbox,
  Reply,
  CheckCheck,
  Search,
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { geminiGenerateContent } from '../../services/geminiProxy';
import { db, auth } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy, updateDoc, doc } from '@/lib/portal-firestore';
import { QCAAQuiz } from '@/types';
import { cn } from '@/lib/utils';
import {
  normalizeTeacherTicket,
  readLocalTeacherTickets,
  TeacherTicket,
  teacherClasses,
  writeLocalTeacherTickets,
} from '@/lib/teacher-tickets';

const CLASS_PROGRESS = [
  { student: 'Alex', progress: 85 },
  { student: 'Sarah', progress: 92 },
  { student: 'Jamie', progress: 78 },
  { student: 'Taylor', progress: 64 },
  { student: 'Jordan', progress: 88 },
];

const TEACHER_QUIZZES = [
  { id: 'q1', title: 'Cell Structure Basics', subject: 'Biology', date: '2026-04-01', completion: 95 },
  { id: 'q2', title: 'Genetics & DNA', subject: 'Biology', date: '2026-04-05', completion: 42 },
  { id: 'q3', title: 'Ecosystems', subject: 'Biology', date: '2026-04-10', completion: 0 },
];

export default function TeacherPortal() {
  const location = useLocation();
  const [topic, setTopic] = useState('');
  const [focusArea, setFocusArea] = useState('');
  
  // Quiz Generation State
  const [subject, setSubject] = useState('Biology');
  const [unit, setUnit] = useState('Unit 3: Biodiversity');
  const [teacherNotes, setTeacherNotes] = useState('Focus on the 2024 case study.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizzes, setQuizzes] = useState<QCAAQuiz[]>([]);
  const [tickets, setTickets] = useState<TeacherTicket[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState('All');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [ticketStatusMessage, setTicketStatusMessage] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'qcaa_quizzes'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QCAAQuiz));
      setQuizzes(docs);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'teacherTickets'),
      orderBy('sentAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedTickets = snapshot.docs.map(doc => normalizeTeacherTicket(doc.id, doc.data()));
      setTickets(loadedTickets);
      setSelectedTicketId((currentId) => currentId && loadedTickets.some(ticket => ticket.id === currentId)
        ? currentId
        : loadedTickets[0]?.id || null);
    }, (error) => {
      console.error('Could not load teacher tickets from Firestore:', error);
      const localTickets = readLocalTeacherTickets();
      setTickets(localTickets);
      setSelectedTicketId(localTickets[0]?.id || null);
    });

    return () => unsubscribe();
  }, []);

  const classFilters = useMemo(() => ['All', ...teacherClasses.map((classItem) => classItem.subject)], []);
  const filteredTickets = useMemo(() => {
    const search = ticketSearch.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesClass = selectedClassFilter === 'All' || ticket.classSubject === selectedClassFilter;
      const matchesSearch = !search ||
        ticket.studentName.toLowerCase().includes(search) ||
        ticket.studentEmail.toLowerCase().includes(search) ||
        ticket.subject.toLowerCase().includes(search) ||
        ticket.message.toLowerCase().includes(search) ||
        ticket.classSubject.toLowerCase().includes(search);

      return matchesClass && matchesSearch;
    });
  }, [selectedClassFilter, ticketSearch, tickets]);
  const selectedTicket = filteredTickets.find((ticket) => ticket.id === selectedTicketId) || filteredTickets[0] || null;
  const openTicketCount = tickets.filter((ticket) => ticket.status === 'open').length;
  const repliedTicketCount = tickets.filter((ticket) => ticket.status === 'replied').length;
  const isTicketsPage = location.pathname.startsWith('/admin/teacher/tickets');
  const ticketsByClass = useMemo(() => (
    filteredTickets.reduce<Record<string, TeacherTicket[]>>((groups, ticket) => {
      const key = ticket.classSubject || 'General';
      groups[key] = groups[key] || [];
      groups[key].push(ticket);
      return groups;
    }, {})
  ), [filteredTickets]);

  const formatTicketDate = (date: string) => new Date(date).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  const updateTicketLocally = (updatedTicket: TeacherTicket) => {
    setTickets((currentTickets) => currentTickets.map((ticket) => ticket.id === updatedTicket.id ? updatedTicket : ticket));
    writeLocalTeacherTickets(readLocalTeacherTickets().map((ticket) => ticket.id === updatedTicket.id ? updatedTicket : ticket));
  };

  const handleReplyToTicket = async () => {
    if (!selectedTicket || !replyDraft.trim()) return;

    const reply = {
      message: replyDraft.trim(),
      teacherName: selectedTicket.teacher,
      repliedAt: new Date().toISOString(),
      senderRole: 'teacher' as const,
      senderName: selectedTicket.teacher,
    };
    const updatedTicket: TeacherTicket = {
      ...selectedTicket,
      status: 'replied',
      replies: [...selectedTicket.replies, reply],
    };

    updateTicketLocally(updatedTicket);
    setReplyDraft('');
    setTicketStatusMessage('Reply sent.');

    try {
      await updateDoc(doc(db, 'teacherTickets', selectedTicket.id), {
        status: 'replied',
        replies: updatedTicket.replies,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Could not save ticket reply to Firestore:', error);
      setTicketStatusMessage('Reply saved locally. Firestore sync failed.');
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;

    const updatedTicket: TeacherTicket = {
      ...selectedTicket,
      status: 'closed',
    };

    updateTicketLocally(updatedTicket);
    setTicketStatusMessage('Ticket closed.');

    try {
      await updateDoc(doc(db, 'teacherTickets', selectedTicket.id), {
        status: 'closed',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Could not close ticket in Firestore:', error);
      setTicketStatusMessage('Ticket closed locally. Firestore sync failed.');
    }
  };

  const handleGenerateQuizzes = async () => {
    if (!subject || !unit) return;
    setIsGenerating(true);

    try {
      const systemPrompt = `You are an expert educator specializing in the Queensland Curriculum (QCAA).
Task: Generate a 3-level quiz (Easy, Medium, Complex) based on the specific Subject and Unit provided.
Logic:
- Level 1 (Easy): Recall of facts/definitions from the syllabus.
- Level 2 (Medium): Application of concepts to simple scenarios.
- Level 3 (Complex): Evaluation and analysis (preparing for external exams).
Output Format: Return ONLY a JSON object with level_1, level_2, and level_3 keys, each containing an array of 3 question objects (question, options, correct_answer, and "why_explanation").`;

      // 1. Generate Official QCAA Quiz
      const officialResponse = await geminiGenerateContent({
        model: "gemini-3-flash-preview",
        config: { 
          systemInstruction: systemPrompt,
          responseMimeType: "application/json"
        },
        contents: `Generate the OFFICIAL QCAA Path quiz for Subject: ${subject}, Unit: ${unit}. Strictly follow official standards.`
      });

      const officialData = JSON.parse(officialResponse.text);

      // 2. Generate Teacher's Path Quiz
      const teacherResponse = await geminiGenerateContent({
        model: "gemini-3-flash-preview",
        config: { 
          systemInstruction: systemPrompt,
          responseMimeType: "application/json"
        },
        contents: `Generate the TEACHER'S Path quiz for Subject: ${subject}, Unit: ${unit}. 
Teacher Notes: ${teacherNotes}. 
Strictly prioritize these notes while maintaining QCAA standards.`
      });

      const teacherData = JSON.parse(teacherResponse.text);

      // 3. Save to Firestore
      const batch = [
        {
          subject,
          unit,
          type: 'official',
          data: officialData,
          createdAt: new Date().toISOString(),
        },
        {
          subject,
          unit,
          type: 'teacher',
          teacherNotes,
          teacherId: auth.currentUser?.uid,
          data: teacherData,
          createdAt: new Date().toISOString(),
        }
      ];

      for (const quiz of batch) {
        await addDoc(collection(db, 'qcaa_quizzes'), quiz);
      }

      setTopic('');
      setFocusArea('');
      alert('Quizzes generated successfully!');
    } catch (error) {
      console.error('Error generating quizzes:', error);
      alert('Failed to generate quizzes. Please check console.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isTicketsPage) {
    return (
      <div className="-m-8 flex h-[calc(100vh-80px)] overflow-hidden bg-white lg:-m-12 lg:h-[calc(100vh-80px)]">
        <aside className="flex w-full max-w-[430px] shrink-0 flex-col border-r border-zinc-200 bg-white">
          <div className="shrink-0 border-b border-zinc-100 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black tracking-tight text-zinc-950">Tickets</h1>
                <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-sm font-black text-purple-700">
                  {tickets.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button className="relative rounded-full bg-zinc-100 p-3 text-zinc-500 hover:bg-zinc-200">
                  <Inbox className="h-5 w-5" />
                  {openTicketCount > 0 ? (
                    <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
                  ) : null}
                </button>
                <button className="rounded-full bg-zinc-100 p-3 text-zinc-700 hover:bg-zinc-200">
                  <Plus className="h-5 w-5" />
                </button>
              </div>
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
                className="h-12 rounded-2xl border-none bg-zinc-100 px-4 text-sm font-black text-zinc-700 outline-none"
              >
                {classFilters.map((className) => (
                  <option key={className} value={className}>{className === 'All' ? 'All Classes' : className}</option>
                ))}
              </select>
              <select
                className="h-12 rounded-2xl border-none bg-zinc-100 px-4 text-sm font-black text-zinc-700 outline-none"
                defaultValue="newest"
              >
                <option value="newest">Newest First</option>
                <option value="open">Open First</option>
              </select>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
              <input
                value={ticketSearch}
                onChange={(event) => setTicketSearch(event.target.value)}
                placeholder="Search student, class, or ticket"
                className="h-14 w-full rounded-2xl border-none bg-zinc-100 pl-12 pr-4 text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {filteredTickets.length > 0 ? (
              <div className="space-y-7">
                {Object.entries(ticketsByClass).map(([className, classTickets]) => (
                  <section key={className}>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">{className}</h2>
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
                            onClick={() => {
                              setSelectedTicketId(ticket.id);
                              setTicketStatusMessage('');
                            }}
                            className={cn(
                              'w-full rounded-2xl px-1 py-3 text-left transition',
                              isSelected ? 'bg-blue-50' : 'hover:bg-zinc-50',
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="truncate text-base font-black text-zinc-900">{ticket.studentName}</p>
                                <p className="mt-0.5 truncate text-sm font-bold text-zinc-500">{ticket.subject}</p>
                              </div>
                              <span className="shrink-0 text-xs font-bold text-zinc-400">{formatTicketDate(ticket.sentAt)}</span>
                            </div>
                            <p className="mt-2 truncate text-sm font-semibold text-zinc-500">
                            {latestReply
                              ? `${latestReply.senderRole === 'teacher' ? 'You' : ticket.studentName}: ${latestReply.message}`
                              : ticket.message}
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
                <p className="mt-2 text-sm font-semibold text-zinc-500">Student chats will appear here when tickets are sent.</p>
              </div>
            )}
          </div>
        </aside>

        <section className="hidden min-w-0 flex-1 flex-col bg-white lg:flex">
          {selectedTicket ? (
            <>
              <header className="flex h-24 shrink-0 items-center justify-between border-b border-zinc-100 px-10">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">{selectedTicket.classSubject}</span>
                    <span className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-black capitalize',
                      selectedTicket.status === 'open' ? 'bg-amber-100 text-amber-700' :
                        selectedTicket.status === 'replied' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-zinc-200 text-zinc-600',
                    )}>{selectedTicket.status}</span>
                  </div>
                  <h2 className="truncate text-2xl font-black text-zinc-950">{selectedTicket.studentName}</h2>
                  <p className="truncate text-sm font-semibold text-zinc-500">{selectedTicket.subject}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseTicket}
                  disabled={selectedTicket.status === 'closed'}
                  className="rounded-2xl border-zinc-200 font-black text-zinc-600"
                >
                  <CheckCheck className="mr-2 h-4 w-4" />
                  Close
                </Button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50/50 px-10 py-8">
                <div className="mx-auto max-w-3xl space-y-5">
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
                      <div key={`${selectedTicket.id}-chat-reply-${index}`} className={isTeacherReply ? 'flex justify-end' : 'flex justify-start'}>
                        <div className={cn(
                          'max-w-[78%] rounded-[28px] p-5 shadow-sm',
                          isTeacherReply
                            ? 'rounded-tr-md bg-blue-600 text-white shadow-lg shadow-blue-100'
                            : 'rounded-tl-md bg-white text-zinc-700 ring-1 ring-zinc-100',
                        )}>
                          {!isTeacherReply ? (
                            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                              {replyItem.senderName} · {formatTicketDate(replyItem.repliedAt)}
                            </p>
                          ) : null}
                          <p className="text-sm font-semibold leading-7">{replyItem.message}</p>
                          {isTeacherReply ? (
                            <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-blue-100">
                              {formatTicketDate(replyItem.repliedAt)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <footer className="shrink-0 border-t border-zinc-100 bg-white p-6">
                <div className="mx-auto flex max-w-3xl items-end gap-3">
                  <Textarea
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    placeholder="Write a reply..."
                    className="min-h-[56px] resize-none rounded-2xl border-2 border-zinc-100 bg-zinc-50 font-semibold"
                  />
                  <Button
                    type="button"
                    onClick={handleReplyToTicket}
                    disabled={!replyDraft.trim() || selectedTicket.status === 'closed'}
                    className="h-14 rounded-2xl bg-blue-600 px-6 font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700"
                  >
                    <Reply className="mr-2 h-4 w-4" />
                    Reply
                  </Button>
                </div>
                {ticketStatusMessage ? (
                  <p className="mx-auto mt-2 max-w-3xl text-xs font-bold text-emerald-600">{ticketStatusMessage}</p>
                ) : null}
              </footer>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <div className="relative mb-8 flex h-32 w-32 items-center justify-center rounded-[36px] bg-white shadow-2xl shadow-zinc-200">
                <MessageSquare className="h-14 w-14 text-blue-600" />
                <span className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-sm">
                  <CheckCircle className="h-5 w-5" />
                </span>
              </div>
              <h2 className="text-3xl font-black text-zinc-950">Your Inbox is Ready</h2>
              <p className="mt-5 max-w-xl text-xl font-medium leading-9 text-zinc-500">
                Select a student conversation on the left to start replying to ticket updates.
              </p>
              <Button className="mt-10 h-14 rounded-2xl bg-blue-600 px-9 text-base font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700">
                <Plus className="mr-2 h-5 w-5" />
                Start New Conversation
              </Button>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-br from-indigo-600 to-purple-600 p-10 rounded-[40px] shadow-2xl text-white">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <Badge className="bg-white/20 text-white border-none">The Coach</Badge>
          </div>
          <h1 className="text-4xl font-black tracking-tight">Teacher Command Center</h1>
          <p className="text-indigo-100 font-medium">Input focus areas, view class progress, and set teacher quizzes.</p>
        </div>
        <div className="flex gap-3">
          <Button className="bg-white text-indigo-600 hover:bg-indigo-50 rounded-2xl h-12 px-6 font-bold">
            <Plus className="mr-2 h-4 w-4" />
            Create Quiz
          </Button>
          <Button variant="outline" className="border-white/30 hover:bg-white/10 text-white rounded-2xl h-12 px-6 font-bold">
            <MessageSquare className="mr-2 h-4 w-4" />
            Class Chat
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl shadow-zinc-200/50 rounded-[32px] overflow-hidden">
        <CardHeader className="border-b border-zinc-100 bg-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-purple-500">
                <Inbox className="h-4 w-4" />
                Student Tickets
              </div>
              <CardTitle className="text-2xl font-black tracking-tight">Teacher Ticket Inbox</CardTitle>
              <CardDescription className="font-medium">
                Tickets are grouped by class so teachers can review, reply, and close requests.
              </CardDescription>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-zinc-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total</p>
                <p className="text-2xl font-black text-zinc-900">{tickets.length}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Open</p>
                <p className="text-2xl font-black text-amber-700">{openTicketCount}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Replied</p>
                <p className="text-2xl font-black text-emerald-700">{repliedTicketCount}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[220px_330px_1fr]">
            <aside className="border-b border-zinc-100 bg-zinc-50/70 p-4 lg:border-b-0 lg:border-r">
              <p className="mb-3 px-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Classes</p>
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
                        setSelectedClassFilter(className);
                        const nextTicket = className === 'All'
                          ? tickets[0]
                          : tickets.find((ticket) => ticket.classSubject === className);
                        setSelectedTicketId(nextTicket?.id || null);
                        setTicketStatusMessage('');
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-black transition',
                        selectedClassFilter === className
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-100'
                          : 'text-zinc-600 hover:bg-white hover:text-zinc-900',
                      )}
                    >
                      <span>{className}</span>
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px]',
                        selectedClassFilter === className ? 'bg-white/20 text-white' : 'bg-white text-zinc-400',
                      )}>
                        {classCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="border-b border-zinc-100 p-4 lg:border-b-0 lg:border-r">
              <p className="mb-3 px-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Ticket List</p>
              {filteredTickets.length > 0 ? (
                <div className="space-y-2">
                  {filteredTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => {
                        setSelectedTicketId(ticket.id);
                        setTicketStatusMessage('');
                      }}
                      className={cn(
                        'w-full rounded-2xl border p-4 text-left transition',
                        selectedTicket?.id === ticket.id
                          ? 'border-purple-200 bg-purple-50'
                          : 'border-zinc-100 bg-white hover:border-zinc-200 hover:bg-zinc-50',
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="truncate text-[10px] font-black uppercase tracking-widest text-zinc-400">
                          {ticket.classSubject}
                        </span>
                        <span className={cn(
                          'shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest',
                          ticket.status === 'open' ? 'bg-amber-100 text-amber-700' :
                            ticket.status === 'replied' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-zinc-200 text-zinc-600',
                        )}>
                          {ticket.status}
                        </span>
                      </div>
                      <h3 className="line-clamp-2 text-sm font-black leading-tight text-zinc-900">{ticket.subject}</h3>
                      <p className="mt-2 truncate text-xs font-semibold text-zinc-500">{ticket.studentName}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{formatTicketDate(ticket.sentAt)}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
                  <p className="font-black text-zinc-900">No tickets here</p>
                  <p className="mt-2 text-xs font-semibold text-zinc-500">Choose another class or wait for student requests.</p>
                </div>
              )}
            </section>

            <section className="p-5">
              {selectedTicket ? (
                <div className="flex h-full flex-col">
                  <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge className="rounded-lg bg-purple-100 text-purple-700 border-none">{selectedTicket.classSubject}</Badge>
                        <Badge className="rounded-lg bg-zinc-100 text-zinc-600 border-none">{selectedTicket.tag}</Badge>
                      </div>
                      <h3 className="text-2xl font-black leading-tight text-zinc-900">{selectedTicket.subject}</h3>
                      <p className="mt-2 text-sm font-semibold text-zinc-500">
                        From {selectedTicket.studentName} {selectedTicket.studentEmail ? `(${selectedTicket.studentEmail})` : ''} · {formatTicketDate(selectedTicket.sentAt)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCloseTicket}
                      disabled={selectedTicket.status === 'closed'}
                      className="rounded-2xl border-zinc-200 font-black text-zinc-600"
                    >
                      <CheckCheck className="mr-2 h-4 w-4" />
                      Close
                    </Button>
                  </div>

                  <div className="rounded-3xl border border-zinc-100 bg-zinc-50 p-5">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Student Message</p>
                    <p className="text-sm font-semibold leading-7 text-zinc-700">{selectedTicket.message}</p>
                  </div>

                  <div className="mt-5 flex-1 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Replies</p>
                    {selectedTicket.replies.length > 0 ? (
                      selectedTicket.replies.map((replyItem, index) => {
                        const isTeacherReply = replyItem.senderRole === 'teacher';
                        return (
                          <div
                            key={`${selectedTicket.id}-teacher-reply-${index}`}
                            className={cn(
                              'rounded-3xl border p-4',
                              isTeacherReply
                                ? 'border-emerald-100 bg-emerald-50'
                                : 'border-blue-100 bg-blue-50',
                            )}
                          >
                            <p className={cn(
                              'text-sm font-semibold leading-6',
                              isTeacherReply ? 'text-emerald-950' : 'text-blue-950',
                            )}>{replyItem.message}</p>
                            <p className={cn(
                              'mt-2 text-[10px] font-black uppercase tracking-widest',
                              isTeacherReply ? 'text-emerald-700' : 'text-blue-700',
                            )}>
                              {isTeacherReply ? replyItem.senderName : selectedTicket.studentName} · {formatTicketDate(replyItem.repliedAt)}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-3xl border border-dashed border-zinc-200 bg-white p-5 text-sm font-semibold text-zinc-400">
                        No replies yet.
                      </div>
                    )}
                  </div>

                  <div className="mt-5 border-t border-zinc-100 pt-5">
                    <Label htmlFor="ticket-reply" className="text-xs font-black uppercase tracking-widest text-zinc-400">Reply to student</Label>
                    <Textarea
                      id="ticket-reply"
                      value={replyDraft}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      placeholder="Write a clear teacher reply..."
                      className="mt-2 min-h-[110px] rounded-2xl border-2 border-zinc-100 font-semibold"
                    />
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-bold text-emerald-600">{ticketStatusMessage}</p>
                      <Button
                        type="button"
                        onClick={handleReplyToTicket}
                        disabled={!replyDraft.trim() || selectedTicket.status === 'closed'}
                        className="rounded-2xl bg-purple-600 font-black text-white hover:bg-purple-700"
                      >
                        <Reply className="mr-2 h-4 w-4" />
                        Send Reply
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 text-center">
                  <Inbox className="mb-4 h-10 w-10 text-zinc-300" />
                  <p className="text-lg font-black text-zinc-900">No ticket selected</p>
                  <p className="mt-2 max-w-sm text-sm font-semibold text-zinc-500">Student tickets will appear here when they are sent from the Teachers page.</p>
                </div>
              )}
            </section>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Topic Input */}
        <Card className="lg:col-span-1 border-none shadow-xl shadow-zinc-200/50 rounded-[32px] overflow-hidden">
          <CardHeader className="bg-zinc-50 border-b border-zinc-100">
            <CardTitle className="text-xl font-black tracking-tight">QCAA Quiz Master</CardTitle>
            <CardDescription className="font-medium">Generate dual-path quizzes for your students.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-xs font-black uppercase tracking-widest text-zinc-400">Subject</Label>
              <Input 
                id="subject" 
                placeholder="e.g. Biology" 
                className="rounded-xl border-2 border-zinc-100 h-12 font-bold"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit" className="text-xs font-black uppercase tracking-widest text-zinc-400">Unit / Module</Label>
              <Input 
                id="unit" 
                placeholder="e.g. Unit 3: Biodiversity" 
                className="rounded-xl border-2 border-zinc-100 h-12 font-bold"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-xs font-black uppercase tracking-widest text-zinc-400">Teacher Notes (Focus Areas)</Label>
              <Textarea 
                id="notes" 
                placeholder="e.g. Focus on the 2024 case study..." 
                className="rounded-xl border-2 border-zinc-100 min-h-[100px] font-bold"
                value={teacherNotes}
                onChange={(e) => setTeacherNotes(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleGenerateQuizzes}
              disabled={isGenerating}
              className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-2xl h-14 font-black text-lg shadow-lg shadow-indigo-100"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate Dual Quiz
                </>
              )}
            </Button>
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <CheckCircle className="h-3 w-3 text-emerald-500" />
                Official QCAA Path
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <CheckCircle className="h-3 w-3 text-emerald-500" />
                Teacher-Led Path
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Class Progress */}
        <Card className="lg:col-span-2 border-none shadow-xl shadow-zinc-200/50 rounded-[32px]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black tracking-tight">Class Progress Overview</CardTitle>
              <CardDescription className="font-medium">Real-time completion rates for current unit.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Live Sync</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CLASS_PROGRESS}>
                  <defs>
                    <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="student" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 'bold', fill: '#a1a1aa' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 'bold', fill: '#a1a1aa' }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="progress" 
                    stroke="#6366f1" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorProgress)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Teacher Quizzes */}
        <Card className="lg:col-span-3 border-none shadow-xl shadow-zinc-200/50 rounded-[32px]">
          <CardHeader>
            <CardTitle className="text-xl font-black tracking-tight">Active QCAA Quizzes</CardTitle>
            <CardDescription className="font-medium">Quizzes currently available to your students.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {quizzes.map((quiz, i) => (
                <div key={quiz.id} className="p-6 rounded-[32px] bg-zinc-50 border border-zinc-100 hover:bg-zinc-100 transition-all group cursor-pointer">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 rounded-2xl bg-white border border-zinc-200 group-hover:border-indigo-200 transition-colors">
                      <FileText className="h-6 w-6 text-indigo-500" />
                    </div>
                    <Badge className={cn(
                      "rounded-lg px-2 py-1 font-black text-[8px] uppercase tracking-widest",
                      quiz.type === 'official' ? "bg-indigo-500/10 text-indigo-600" : "bg-purple-500/10 text-purple-600"
                    )}>
                      {quiz.type === 'official' ? 'Official QCAA' : 'Teacher Led'}
                    </Badge>
                  </div>
                  <h4 className="text-lg font-black text-zinc-900 group-hover:text-indigo-600 transition-colors">{quiz.unit}</h4>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">{quiz.subject}</p>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      <span>Questions</span>
                      <span>9 (3 per level)</span>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Clock className="h-3 w-3" />
                        <span className="text-[10px] font-bold">{new Date(quiz.createdAt).toLocaleDateString()}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg font-black text-[10px] uppercase tracking-widest text-indigo-600 hover:bg-indigo-50">
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {quizzes.length === 0 && (
                <div className="md:col-span-3 p-12 border-2 border-dashed border-zinc-200 rounded-[32px] flex flex-col items-center justify-center text-center space-y-4">
                  <div className="p-4 rounded-full bg-zinc-100">
                    <Sparkles className="h-8 w-8 text-zinc-400" />
                  </div>
                  <div>
                    <p className="font-black text-zinc-900">No Quizzes Yet</p>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Generate your first dual-path quiz above.</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
