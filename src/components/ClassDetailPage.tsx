import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  FlaskConical, 
  BookOpen, 
  Timer, 
  Users, 
  ExternalLink, 
  Save, 
  ArrowLeft,
  Clock,
  Trophy,
  Play,
  Pause,
  RotateCcw,
  MessageSquare,
  BookMarked,
  ChevronRight,
  Sparkles,
  NotebookPen,
  Plus,
  StickyNote
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from '@/lib/portal-firestore';
import type { Assignment, Note } from '../types';
import { detectStudentPortalFromPath, studentPortalPath, studentPortalToolPath } from '@/lib/portal';

export default function ClassDetailPage() {
  const { subjectName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isPhone } = useResponsiveDevice();
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState('');
  const [timeLeft, setTimeLeft] = useState(1500); // 25 minutes default
  const [isActive, setIsActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [classWorkbooks, setClassWorkbooks] = useState<Assignment[]>([]);
  const [classStickyNotes, setClassStickyNotes] = useState<Note[]>([]);
  const [isSavingQuickNote, setIsSavingQuickNote] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(1500);
  };
  const mobileInlineWorkbook = isPhone && String(subjectName || '').trim().length <= 6;
  const subjectLabel = String(subjectName || 'Class').trim() || 'Class';
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const classesPath = studentPortalPath(activePortal, '/classes');
  const workbooksPath = studentPortalToolPath(activePortal, 'workbooks');
  const microsoftWorkbookPath = activePortal === 'university'
    ? '/uni/workbooks-uni/word'
    : '/workbooks/word';
  const notesPath = studentPortalPath(activePortal, `/notes?folder=${encodeURIComponent(subjectLabel)}`);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userId) {
      setClassWorkbooks([]);
      return;
    }

    const q = query(
      collection(db, 'assignments'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Assignment))
        .filter((item) => {
          const itemSubject = item.classSubject?.trim().toLowerCase();
          const normalizedSubject = subjectLabel.toLowerCase();
          return itemSubject === normalizedSubject || item.title.toLowerCase().includes(`${normalizedSubject} workbook`);
        });
      setClassWorkbooks(items);
    });

    return () => unsub();
  }, [subjectLabel, userId]);

  useEffect(() => {
    if (!userId) {
      setClassStickyNotes([]);
      return;
    }

    const q = query(
      collection(db, 'notes'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Note))
        .filter((item) => {
          const folder = (item.folder || '').trim().toLowerCase();
          const itemSubject = item.classSubject?.trim().toLowerCase();
          const normalizedSubject = subjectLabel.toLowerCase();
          return folder === normalizedSubject || itemSubject === normalizedSubject;
        });
      setClassStickyNotes(items);
    });

    return () => unsub();
  }, [subjectLabel, userId]);

  const openOrCreateWorkbook = async () => {
    if (!userId) return;

    const existing = classWorkbooks[0];
    if (existing) {
      navigate(workbooksPath, { state: { openAssignmentId: existing.id } });
      return;
    }

    const title = `${subjectLabel} Workbook`;
    const docRef = await addDoc(collection(db, 'assignments'), {
      userId,
      title,
      content: '',
      classSubject: subjectLabel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    navigate(workbooksPath, { state: { openAssignmentId: docRef.id } });
  };

  const openMicrosoftWorkbook = () => {
    if (!userId) return;
    navigate(`${microsoftWorkbookPath}?userId=${encodeURIComponent(userId)}`);
  };

  const saveQuickClassNote = async () => {
    if (!userId || !note.trim()) return;
    setIsSavingQuickNote(true);
    try {
      const trimmedNote = note.trim();
      await addDoc(collection(db, 'notes'), {
        userId,
        title: trimmedNote.split('\n')[0].slice(0, 42) || `${subjectLabel} note`,
        text: trimmedNote,
        color: ['bg-amber-100', 'bg-sky-100', 'bg-emerald-100', 'bg-rose-100', 'bg-purple-100'][Math.floor(Math.random() * 5)],
        folder: subjectLabel,
        classSubject: subjectLabel,
        tags: tags.split(',').map((value) => value.trim()).filter(Boolean),
        position: { x: 0, y: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNote('');
      setTags('');
    } finally {
      setIsSavingQuickNote(false);
    }
  };

  const placeholderWorkbooks = useMemo(() => {
    if (classWorkbooks.length > 0) return classWorkbooks;
    return [];
  }, [classWorkbooks]);

  const stats = [
    { label: 'Completion', value: '52%', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Next Class', value: isPhone ? 'Thu\n11:15' : 'Thu, 11:15', icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Time Studied', value: '1.8h', icon: Timer, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const resources = [
    { name: 'PhET Simulations', desc: 'Interactive visual experiments' },
    { name: 'Khan Academy', desc: 'Detailed video lectures' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Navigation Bar */}
      <nav
        className={cn(
          "relative z-0 bg-white",
          isPhone
            ? "mx-4 mt-4 rounded-[28px] border border-zinc-100 px-4 py-4 shadow-sm"
            : "mx-8 mt-6 rounded-[30px] border border-zinc-100 px-6 py-5 shadow-sm"
        )}
      >
        {isPhone ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <button
                onClick={() => navigate(classesPath)}
                className="shrink-0 rounded-xl p-1.5 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <FlaskConical size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                    Class Page
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <h1 className="min-w-0 break-words text-[1.08rem] font-bold leading-tight text-zinc-900">
                      {subjectLabel}
                    </h1>
                    {mobileInlineWorkbook && (
                      <button onClick={openMicrosoftWorkbook} className="shrink-0 rounded-xl bg-indigo-600 px-3.5 py-2 text-[0.78rem] font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700">
                        Workbook
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className={cn("flex items-center gap-2 pl-10", mobileInlineWorkbook ? "justify-start" : "justify-start flex-wrap")}>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-2 text-[0.72rem] font-bold leading-tight text-emerald-600">
                <Trophy size={14} />
                <span className="text-center">
                  4 Day
                  <br />
                  Streak
                </span>
              </div>
              {!mobileInlineWorkbook && (
                <button onClick={openMicrosoftWorkbook} className="rounded-xl bg-indigo-600 px-3.5 py-2 text-[0.78rem] font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700">
                  Workbook
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate(classesPath)}
                className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
              >
                <ArrowLeft size={24} />
              </button>
              <div className="h-6 w-[1px] bg-zinc-100" />
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <FlaskConical size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Class Page</p>
                  <h1 className="text-xl font-bold text-zinc-900">{subjectLabel}</h1>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-600">
                <Trophy size={16} />
                4 Day Streak
              </div>
              <button onClick={openMicrosoftWorkbook} className="rounded-xl bg-indigo-600 px-6 py-2 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700">
                Open Workbook
              </button>
            </div>
          </>
        )}
      </nav>

      <main className={cn("mx-auto grid w-full max-w-7xl flex-1 grid-cols-1", isPhone ? "gap-5 px-4 pb-6 pt-4" : "gap-8 p-8 lg:grid-cols-12")}>
        
        {/* Left Column: Main Learning Content */}
        <div className={cn(isPhone ? "space-y-5" : "space-y-8 lg:col-span-8")}>
          
          {/* Overview Stats */}
          <div className={cn("grid", isPhone ? "grid-cols-3 gap-3" : "grid-cols-3 gap-4")}>
            {stats.map((stat) => (
              <div key={stat.label} className={cn("rounded-3xl border border-zinc-100 bg-white shadow-sm", isPhone ? "p-3" : "p-5")}>
                <div className={cn("mb-2 flex items-center justify-center rounded-xl", stat.bg, stat.color, isPhone ? "h-9 w-9" : "h-10 w-10")}>
                  <stat.icon size={isPhone ? 18 : 20} />
                </div>
                <p className={cn("font-bold uppercase tracking-wider text-zinc-400", isPhone ? "text-[9px] leading-tight" : "text-xs")}>{stat.label}</p>
                <p className={cn("mt-1 font-black text-zinc-900", isPhone ? "text-[1.15rem] leading-tight whitespace-pre-line" : "text-xl")}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Workbooks Section */}
          <section>
            <div className={cn("flex items-center justify-between", isPhone ? "mb-3" : "mb-4")}>
              <h2 className={cn("flex items-center gap-2 font-black text-zinc-900", isPhone ? "text-base" : "text-lg")}>
                <BookMarked size={isPhone ? 18 : 20} className="text-indigo-600" />
                Active Workbooks
              </h2>
              <button onClick={() => navigate(workbooksPath)} className={cn("font-bold text-indigo-600 hover:underline", isPhone ? "text-xs" : "text-sm")}>View All</button>
            </div>
            {placeholderWorkbooks.length > 0 ? (
              <div className={cn(isPhone ? "space-y-2.5" : "space-y-3")}>
                {placeholderWorkbooks.map((wb) => (
                  <button
                    key={wb.id}
                    onClick={() => navigate(workbooksPath, { state: { openAssignmentId: wb.id } })}
                    className={cn("group w-full rounded-2xl border border-zinc-100 bg-white text-left shadow-sm transition-all hover:border-indigo-200", isPhone ? "flex items-center gap-3 p-3" : "flex items-center gap-4 p-4")}
                  >
                    <div className={cn("flex items-center justify-center rounded-xl bg-zinc-50 text-zinc-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600", isPhone ? "h-11 w-11" : "h-12 w-12")}>
                      <BookOpen size={isPhone ? 20 : 24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn("flex items-center justify-between", isPhone ? "mb-1.5 gap-3" : "mb-1.5")}>
                        <h3 className={cn("font-bold text-zinc-900", isPhone ? "text-[0.98rem] leading-tight" : "")}>{wb.title}</h3>
                        <span className="text-[10px] font-black uppercase text-zinc-400">Workbook</span>
                      </div>
                      <p className={cn("text-zinc-500", isPhone ? "text-[11px]" : "text-sm")}>
                        {wb.updatedAt ? `Last updated ${new Date(wb.updatedAt).toLocaleDateString()}` : 'Ready to keep building from this class page.'}
                      </p>
                    </div>
                    <ChevronRight size={isPhone ? 18 : 20} className="text-zinc-300" />
                  </button>
                ))}
              </div>
            ) : (
              <div className={cn("rounded-[28px] border border-dashed border-zinc-200 bg-white shadow-sm", isPhone ? "p-4" : "p-5")}>
                <div className="flex items-start gap-3">
                  <div className={cn("rounded-2xl bg-indigo-50 text-indigo-600", isPhone ? "p-2.5" : "p-3")}>
                    <BookOpen size={isPhone ? 18 : 20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={cn("font-bold text-zinc-900", isPhone ? "text-[0.98rem]" : "text-base")}>No workbooks in {subjectLabel} yet</h3>
                    <p className={cn("mt-1 text-zinc-500", isPhone ? "text-[11px]" : "text-sm")}>
                      Start a workbook for this class, then it will appear here automatically.
                    </p>
                    <div className={cn("mt-4 flex gap-2", isPhone ? "flex-col" : "flex-wrap")}>
                      <button onClick={openOrCreateWorkbook} className={cn("rounded-xl bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700", isPhone ? "w-full px-4 py-2.5 text-sm" : "px-4 py-2 text-sm")}>
                        Add workbook
                      </button>
                      <button
                        onClick={() => noteInputRef.current?.focus()}
                        className={cn("rounded-xl border border-zinc-200 bg-white font-bold text-zinc-700 hover:bg-zinc-50", isPhone ? "w-full px-4 py-2.5 text-sm" : "px-4 py-2 text-sm")}
                      >
                        Add class note
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Quick Note Area */}
          <section>
            <h2 className={cn("mb-4 flex items-center gap-2 font-black text-zinc-900", isPhone ? "mb-3 text-base" : "text-lg")}>
              <Sparkles size={isPhone ? 18 : 20} className="text-indigo-600" />
              Quick Capture
            </h2>
            <div className={cn("rounded-[32px] border border-zinc-100 bg-white shadow-sm", isPhone ? "p-4" : "p-6")}>
              <textarea 
                ref={noteInputRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's on your mind for this class?"
                className={cn("w-full resize-none border-none bg-transparent text-zinc-700 placeholder:text-zinc-300 focus:ring-0", isPhone ? "h-20 text-base" : "h-24 text-lg")}
              />
              <div className={cn("border-zinc-50 pt-4", isPhone ? "space-y-3 border-t" : "flex items-center justify-between border-t")}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-400">Tags:</span>
                  <input 
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="lab, exam..."
                    className={cn("rounded-full border-none bg-zinc-50 font-medium focus:ring-1 focus:ring-indigo-100", isPhone ? "w-28 px-3 py-1.5 text-xs" : "w-32 px-3 py-1 text-xs")}
                  />
                </div>
                <button
                  onClick={saveQuickClassNote}
                  disabled={!note.trim() || isSavingQuickNote}
                  className={cn("flex items-center justify-center gap-2 rounded-xl bg-zinc-900 font-bold text-white transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50", isPhone ? "w-full px-4 py-2.5 text-sm" : "px-5 py-2 text-sm")}
                >
                  <Save size={16} />
                  {isSavingQuickNote ? 'Saving…' : 'Save Note'}
                </button>
              </div>
            </div>
          </section>

          {/* Resources Grid */}
          <section>
            <h2 className={cn("mb-4 flex items-center gap-2 font-black text-zinc-900", isPhone ? "mb-3 text-base" : "text-lg")}>
              <ExternalLink size={isPhone ? 18 : 20} className="text-indigo-600" />
              Learning Resources
            </h2>
            <div className={cn("grid gap-4", isPhone ? "grid-cols-1 gap-3" : "grid-cols-2")}>
              {resources.map((res) => (
                <div key={res.name} className={cn("group cursor-pointer rounded-3xl border border-zinc-100 bg-white shadow-sm transition-all hover:shadow-md", isPhone ? "p-4" : "p-5")}>
                  <h3 className={cn("font-bold text-zinc-900 transition-colors group-hover:text-indigo-600", isPhone ? "text-[0.98rem]" : "")}>{res.name}</h3>
                  <p className={cn("mt-1 text-zinc-500", isPhone ? "text-[11px]" : "text-xs")}>{res.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Utilities & Social */}
        <div className={cn(isPhone ? "space-y-5" : "space-y-6 lg:col-span-4")}>
          
          {/* Focus Timer Card */}
          <div className={cn("rounded-[40px] bg-indigo-600 text-white shadow-xl shadow-indigo-200", isPhone ? "p-5" : "p-8")}>
            <div className={cn("flex items-center justify-between", isPhone ? "mb-5" : "mb-8")}>
              <p className={cn("font-bold uppercase opacity-70 tracking-widest", isPhone ? "text-[11px]" : "text-sm")}>Focus Session</p>
              <Timer size={isPhone ? 18 : 20} className="opacity-70" />
            </div>
            <div className={cn("text-center", isPhone ? "mb-5" : "mb-8")}>
              <h2 className={cn("font-black tabular-nums tracking-tighter", isPhone ? "text-5xl" : "text-6xl")}>
                {formatTime(timeLeft)}
              </h2>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={toggleTimer}
                className={cn("flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white font-black text-indigo-600 transition-all hover:bg-indigo-50", isPhone ? "h-12 text-sm" : "h-14")}
              >
                {isActive ? <Pause size={isPhone ? 20 : 24} fill="currentColor" /> : <Play size={isPhone ? 20 : 24} fill="currentColor" />}
                {isActive ? 'Pause' : 'Start'}
              </button>
              <button 
                onClick={resetTimer}
                className={cn("flex items-center justify-center rounded-2xl bg-indigo-500 text-white transition-all hover:bg-indigo-400", isPhone ? "h-12 w-12" : "h-14 w-14")}
              >
                <RotateCcw size={isPhone ? 20 : 24} />
              </button>
            </div>
          </div>

          {/* Study Buddy Card */}
          <div className={cn("rounded-[32px] border border-zinc-100 bg-white shadow-sm", isPhone ? "p-5" : "p-6")}>
            <h3 className={cn("mb-4 font-bold uppercase tracking-widest text-zinc-400", isPhone ? "text-[11px]" : "text-sm")}>Study Buddy</h3>
            <div className={cn("flex items-center", isPhone ? "mb-5 gap-3" : "mb-6 gap-4")}>
              <div className="relative">
                <div className={cn("flex items-center justify-center rounded-2xl bg-indigo-100 font-bold text-indigo-600", isPhone ? "h-12 w-12 text-lg" : "h-14 w-14 text-xl")}>
                  JK
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
              <div>
                <h4 className={cn("font-bold text-zinc-900", isPhone ? "text-[0.98rem]" : "")}>Jamie Kobella</h4>
                <p className="text-xs text-zinc-500">Year 10 • Online</p>
              </div>
            </div>
            <button className={cn("flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-50 font-bold text-zinc-900 transition-all hover:bg-zinc-100", isPhone ? "py-2.5 text-sm" : "py-3")}>
              <MessageSquare size={18} />
              Message Jamie
            </button>
          </div>

          {/* Class Notes */}
          <div className={cn("rounded-[32px] border border-zinc-100 bg-white shadow-sm", isPhone ? "p-5" : "p-6")}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className={cn("font-bold uppercase tracking-widest text-zinc-400", isPhone ? "text-[11px]" : "text-sm")}>Class Notes</h3>
              <button
                onClick={() => navigate(notesPath)}
                className={cn("font-bold text-indigo-600 hover:underline", isPhone ? "text-[11px]" : "text-xs")}
              >
                Open Notes
              </button>
            </div>
            {classStickyNotes.length > 0 ? (
              <div className="space-y-3">
                {classStickyNotes.slice(0, 3).map((classNote) => (
                  <div key={classNote.id} className={cn("rounded-2xl border border-zinc-100 px-4 py-3 shadow-sm", classNote.color || 'bg-zinc-50')}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-lg bg-white/80 p-2 text-zinc-500">
                        <StickyNote size={isPhone ? 14 : 16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className={cn("font-bold text-zinc-900", isPhone ? "text-[0.92rem]" : "text-sm")}>{classNote.title}</h4>
                        <p className={cn("mt-1 line-clamp-3 whitespace-pre-wrap text-zinc-700", isPhone ? "text-[11px]" : "text-xs")}>{classNote.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-white p-2.5 text-indigo-600 shadow-sm">
                    <NotebookPen size={isPhone ? 16 : 18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className={cn("font-bold text-zinc-900", isPhone ? "text-[0.92rem]" : "text-sm")}>No sticky notes for {subjectLabel} yet</h4>
                    <p className={cn("mt-1 text-zinc-500", isPhone ? "text-[11px]" : "text-xs")}>
                      Save a quick capture and it will appear here and in your Notes folder for this class.
                    </p>
                    <button
                      onClick={() => noteInputRef.current?.focus()}
                      className={cn("mt-3 rounded-xl bg-zinc-900 font-bold text-white hover:bg-zinc-800", isPhone ? "px-3.5 py-2 text-xs" : "px-4 py-2 text-sm")}
                    >
                      Add class note
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
