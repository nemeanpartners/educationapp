import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  CalendarPlus,
  Clock, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight,
  Filter,
  ArrowUpDown,
  Loader2,
  BookOpen,
  GraduationCap,
  FileText,
  Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  doc,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch
} from '@/lib/portal-firestore';
import { format, formatDistanceToNow, isPast, isToday, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import { Deadline } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useResponsiveDevice } from '../hooks/use-responsive-device';

const TYPE_ICONS = {
  exam: GraduationCap,
  assignment: FileText,
  quiz: BookOpen,
  project: Layout,
  other: AlertCircle
};

const PRIORITY_COLORS = {
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  high: 'bg-rose-100 text-rose-700 border-rose-200'
};

const createAssignmentSteps = () => [
  { id: 1, title: 'Pick Subject', tasks: [], completed: false },
  { id: 2, title: 'Research', tasks: [], completed: false },
  { id: 3, title: 'Planning', tasks: [], completed: false },
  { id: 4, title: 'Drafting', tasks: [], completed: false },
  {
    id: 5,
    title: 'Review',
    tasks: [{
      id: crypto.randomUUID(),
      text: 'Get my references (IEEE or Harvard)',
      completed: false,
      priority: 'high'
    }],
    completed: false
  }
];

const createExamSteps = () => [
  { id: 1, title: 'Topic Mapping', tasks: [], completed: false },
  { id: 2, title: 'Resource Hub', tasks: [], completed: false },
  { id: 3, title: 'Active Revision', tasks: [], completed: false },
  { id: 4, title: 'Mock Exams', tasks: [], completed: false },
  { id: 5, title: 'Final Polish', tasks: [], completed: false }
];

const toDateOnly = (dateTime: string) => dateTime.split('T')[0] || dateTime;

const escapeIcsText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

const formatIcsDateTime = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

export default function DeadlinesPage() {
  const { isPhone } = useResponsiveDevice();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    course: '',
    dueDate: '',
    type: 'assignment' as Deadline['type'],
    priority: 'medium' as Deadline['priority']
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'deadlines'),
      where('userId', '==', user.uid),
      orderBy('dueDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Convert Firestore Timestamp to ISO string if needed
          dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate().toISOString() : data.dueDate
        };
      }) as Deadline[];
      setDeadlines(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'deadlines');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const upcomingDeadlines = useMemo(() => {
    return deadlines.filter(d => !d.completed && !isPast(parseISO(d.dueDate)));
  }, [deadlines]);

  const pastDeadlines = useMemo(() => {
    return deadlines.filter(d => d.completed || isPast(parseISO(d.dueDate)));
  }, [deadlines]);

  const handleAddDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setIsAdding(true);
    try {
      const batch = writeBatch(db);
      const deadlineRef = doc(collection(db, 'deadlines'));
      const deadlineDate = new Date(formData.dueDate);

      const deadlineData = {
        userId: user.uid,
        ...formData,
        completed: false,
        createdAt: serverTimestamp(),
        dueDate: deadlineDate
      };

      batch.set(deadlineRef, deadlineData);

      if (formData.type === 'assignment' || formData.type === 'project') {
        const assignmentPlanRef = doc(collection(db, 'assignmentPlans'));
        batch.set(assignmentPlanRef, {
          userId: user.uid,
          title: formData.title,
          subject: formData.course,
          assignmentType: formData.type === 'project' ? 'Other' : 'Essay',
          dueDate: toDateOnly(formData.dueDate),
          currentStep: 1,
          steps: createAssignmentSteps(),
          researchResources: [],
          researchKeyPoints: [],
          deadlineId: deadlineRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        batch.update(deadlineRef, { assignmentPlanId: assignmentPlanRef.id });
      }

      if (formData.type === 'exam' || formData.type === 'quiz') {
        const examPlanRef = doc(collection(db, 'examPlans'));
        batch.set(examPlanRef, {
          userId: user.uid,
          title: formData.title,
          subject: formData.course,
          yearLevel: '10',
          examDate: toDateOnly(formData.dueDate),
          topics: [],
          currentStep: 1,
          steps: createExamSteps(),
          resources: [],
          focusSessions: [],
          deadlineId: deadlineRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        batch.update(deadlineRef, { examPlanId: examPlanRef.id });
      }

      await batch.commit();

      setShowAddModal(false);
      setFormData({
        title: '',
        course: '',
        dueDate: '',
        type: 'assignment',
        priority: 'medium'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'deadlines');
    } finally {
      setIsAdding(false);
    }
  };

  const toggleComplete = async (deadline: Deadline) => {
    try {
      await updateDoc(doc(db, 'deadlines', deadline.id), {
        completed: !deadline.completed
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `deadlines/${deadline.id}`);
    }
  };

  const deleteDeadline = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'deadlines', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `deadlines/${id}`);
    }
  };

  const handleCalendarSync = (calendarName: 'apple' | 'google') => {
    if (deadlines.length === 0) {
      setCalendarMessage('Add at least one deadline before syncing.');
      return;
    }

    const events = deadlines.map((deadline) => {
      const date = parseISO(deadline.dueDate);
      const endDate = new Date(date.getTime() + 60 * 60 * 1000);
      const description = `${deadline.course} • ${deadline.type}${deadline.completed ? ' • Completed' : ''}`;

      return [
        'BEGIN:VEVENT',
        `UID:deadline-${deadline.id}@edurev-ai`,
        `DTSTAMP:${formatIcsDateTime(new Date())}`,
        `DTSTART:${formatIcsDateTime(date)}`,
        `DTEND:${formatIcsDateTime(endDate)}`,
        `SUMMARY:${escapeIcsText(deadline.title)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeIcsText(`Reminder: ${deadline.title} is due tomorrow.`)}`,
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n');
    }).join('\r\n');

    const calendar = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//EducationRev//Deadlines//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:EducationRev Deadlines',
      events,
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([calendar], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edurev-${calendarName}-deadlines.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCalendarMessage(`${calendarName === 'apple' ? 'Apple' : 'Google'} calendar file downloaded with reminders.`);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className={cn("max-w-6xl mx-auto", isPhone ? "space-y-5 p-4" : "p-8")}>
      <div className={cn("mb-8", isPhone ? "space-y-3" : "flex flex-col md:flex-row md:items-center justify-between gap-4")}>
        <div className="space-y-2">
          <h1 className={cn("font-black text-zinc-900 tracking-tight", isPhone ? "text-[2rem] leading-9" : "text-3xl")}>
            Deadlines & Assessments
          </h1>
          <p className={cn("text-zinc-500", isPhone ? "text-sm leading-6" : "")}>Track your exams, assignments, and key dates.</p>
          {calendarMessage && (
            <p className="text-sm font-bold text-indigo-600">{calendarMessage}</p>
          )}
        </div>
        <div className={cn("gap-2.5", isPhone ? "grid grid-cols-1" : "flex flex-wrap items-center gap-3")}>
          <button
            onClick={() => handleCalendarSync('apple')}
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white font-bold text-zinc-700 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-700",
              isPhone ? "px-4 py-2.5 text-sm" : "px-4 py-3"
            )}
          >
            <CalendarPlus className="h-4 w-4" />
            Sync Apple
          </button>
          <button
            onClick={() => handleCalendarSync('google')}
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white font-bold text-zinc-700 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-700",
              isPhone ? "px-4 py-2.5 text-sm" : "px-4 py-3"
            )}
          >
            <CalendarPlus className="h-4 w-4" />
            Sync Google
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className={cn(
              "flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100",
              isPhone ? "px-5 py-3 text-sm" : "px-6 py-3"
            )}
          >
            <Plus className="h-5 w-5" />
            Add Assessment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Deadlines List */}
        <div className={cn("lg:col-span-2", isPhone ? "space-y-6" : "space-y-8")}>
          {/* Upcoming Section */}
          <section>
            <div className={cn("flex items-center gap-2", isPhone ? "mb-3" : "mb-4")}>
              <Clock className="h-5 w-5 text-indigo-600" />
              <h2 className={cn("font-black text-zinc-900", isPhone ? "text-lg" : "text-xl")}>Upcoming</h2>
            </div>
            
            <div className={cn(isPhone ? "space-y-3" : "space-y-4")}>
              <AnimatePresence mode="popLayout">
                {upcomingDeadlines.length > 0 ? (
                  upcomingDeadlines.map((deadline) => (
                    <DeadlineCard 
                      key={deadline.id} 
                      deadline={deadline} 
                      onToggle={toggleComplete} 
                      onDelete={deleteDeadline} 
                    />
                  ))
                ) : (
                  <div className="bg-zinc-50 border border-dashed border-zinc-200 rounded-3xl p-12 text-center">
                    <Calendar className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
                    <p className="text-zinc-500 font-medium">No upcoming deadlines. You're all caught up!</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Completed / Past Section */}
          {pastDeadlines.length > 0 && (
            <section>
              <div className={cn("flex items-center gap-2", isPhone ? "mb-3" : "mb-4")}>
                <CheckCircle2 className="h-5 w-5 text-zinc-400" />
                <h2 className={cn("font-black text-zinc-400", isPhone ? "text-lg" : "text-xl")}>Past & Completed</h2>
              </div>
              <div className={cn("opacity-60", isPhone ? "space-y-3" : "space-y-4")}>
                {pastDeadlines.map((deadline) => (
                  <DeadlineCard 
                    key={deadline.id} 
                    deadline={deadline} 
                    onToggle={toggleComplete} 
                    onDelete={deleteDeadline} 
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar / Stats */}
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm">
            <h3 className="text-lg font-black text-zinc-900 mb-6">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl">
                <span className="text-indigo-700 font-bold">Total Upcoming</span>
                <span className="text-2xl font-black text-indigo-900">{upcomingDeadlines.length}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-rose-50 rounded-2xl">
                <span className="text-rose-700 font-bold">High Priority</span>
                <span className="text-2xl font-black text-rose-900">
                  {upcomingDeadlines.filter(d => d.priority === 'high').length}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl">
                <span className="text-emerald-700 font-bold">Completed</span>
                <span className="text-2xl font-black text-emerald-900">
                  {deadlines.filter(d => d.completed).length}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 rounded-[32px] p-8 text-white shadow-xl shadow-indigo-100">
            <Sparkles className="h-8 w-8 mb-4 opacity-80" />
            <h3 className="text-xl font-black mb-2">Study Tip</h3>
            <p className="text-indigo-100 text-sm leading-relaxed">
              Break down large assignments into smaller tasks in your To-do list to stay ahead of the deadline!
            </p>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-lg p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-zinc-900">Add Assessment</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <Trash2 className="h-5 w-5 text-zinc-400" />
                </button>
              </div>

              <form onSubmit={handleAddDeadline} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Title</label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Final Exam, Essay Part 1"
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Course / Subject</label>
                  <input
                    required
                    type="text"
                    value={formData.course}
                    onChange={e => setFormData({ ...formData, course: e.target.value })}
                    placeholder="e.g., Advanced Mathematics"
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Due Date</label>
                    <input
                      required
                      type="datetime-local"
                      value={formData.dueDate}
                      onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Type</label>
                    <select
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value as Deadline['type'] })}
                      className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="assignment">Assignment</option>
                      <option value="exam">Exam</option>
                      <option value="quiz">Quiz</option>
                      <option value="project">Project</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Priority</label>
                  <div className="flex gap-2">
                    {(['low', 'medium', 'high'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFormData({ ...formData, priority: p })}
                        className={cn(
                          "flex-1 py-3 rounded-xl font-bold text-sm border transition-all capitalize",
                          formData.priority === p 
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" 
                            : "bg-white text-zinc-500 border-zinc-200 hover:border-indigo-200"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAdding}
                  className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAdding ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
                  Create Deadline
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DeadlineCard({ 
  deadline, 
  onToggle, 
  onDelete 
}: { 
  deadline: Deadline; 
  onToggle: (d: Deadline) => void; 
  onDelete: (id: string) => void;
}) {
  const { isPhone } = useResponsiveDevice();
  const Icon = TYPE_ICONS[deadline.type] || AlertCircle;
  const date = parseISO(deadline.dueDate);
  const isOverdue = isPast(date) && !deadline.completed;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn(
        "group relative bg-white border transition-all hover:shadow-xl hover:shadow-indigo-50/50",
        isPhone ? "rounded-[28px] p-4" : "rounded-3xl p-6",
        deadline.completed ? "border-zinc-100" : isOverdue ? "border-rose-200 bg-rose-50/30" : "border-zinc-200"
      )}
    >
      {isPhone ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-all",
              deadline.completed ? "bg-zinc-100 text-zinc-400" : "bg-indigo-50 text-indigo-600"
            )}>
              <Icon className="h-7 w-7" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className={cn(
                    "line-clamp-2 text-base font-black leading-5 text-zinc-900",
                    deadline.completed && "line-through text-zinc-400"
                  )}>
                    {deadline.title}
                  </h3>
                  <p className="mt-1 text-sm font-bold text-zinc-500">{deadline.course}</p>
                </div>

                <span className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em]",
                  PRIORITY_COLORS[deadline.priority]
                )}>
                  {deadline.priority}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-zinc-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                <Calendar className="h-3.5 w-3.5" />
                Due
              </div>
              <p className={cn("mt-1 text-sm font-black leading-5", isOverdue ? "text-rose-600" : "text-zinc-800")}>
                {format(date, 'MMM d')}
              </p>
              <p className="text-xs font-bold text-zinc-500">{format(date, 'h:mm a')}</p>
            </div>

            <div className="rounded-2xl bg-zinc-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                <Clock className="h-3.5 w-3.5" />
                Status
              </div>
              <p className={cn("mt-1 text-sm font-black leading-5", isOverdue ? "text-rose-600" : deadline.completed ? "text-emerald-600" : "text-indigo-600")}>
                {deadline.completed ? 'Completed' : isOverdue ? 'Overdue' : formatDistanceToNow(date, { addSuffix: true })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggle(deadline)}
              className={cn(
                "flex-1 rounded-2xl px-4 py-3 text-sm font-black transition-all",
                deadline.completed
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
              )}
            >
              {deadline.completed ? 'Mark active' : 'Mark complete'}
            </button>
            <button
              onClick={() => onDelete(deadline.id)}
              className="rounded-2xl bg-zinc-50 p-3 text-zinc-400 transition-all active:scale-[0.98]"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-6">
          <div className={cn(
            "shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
            deadline.completed ? "bg-zinc-100 text-zinc-400" : "bg-indigo-50 text-indigo-600"
          )}>
            <Icon className="h-7 w-7" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className={cn(
                "text-lg font-black text-zinc-900 truncate",
                deadline.completed && "line-through text-zinc-400"
              )}>
                {deadline.title}
              </h3>
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                PRIORITY_COLORS[deadline.priority]
              )}>
                {deadline.priority}
              </span>
            </div>
            
            <p className="text-zinc-500 font-bold text-sm mb-3">{deadline.course}</p>

            <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
              <div className={cn(
                "flex items-center gap-1.5",
                isOverdue ? "text-rose-600" : "text-zinc-400"
              )}>
                <Calendar className="h-3.5 w-3.5" />
                {format(date, 'MMM d, yyyy • h:mm a')}
              </div>
              <div className={cn(
                "flex items-center gap-1.5",
                isOverdue ? "text-rose-600" : "text-indigo-600"
              )}>
                <Clock className="h-3.5 w-3.5" />
                {deadline.completed ? 'Completed' : isOverdue ? 'Overdue' : formatDistanceToNow(date, { addSuffix: true })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggle(deadline)}
              className={cn(
                "p-3 rounded-2xl transition-all",
                deadline.completed 
                  ? "bg-emerald-100 text-emerald-600" 
                  : "bg-zinc-50 text-zinc-300 hover:bg-indigo-50 hover:text-indigo-600"
              )}
            >
              <CheckCircle2 className="h-6 w-6" />
            </button>
            <button
              onClick={() => onDelete(deadline.id)}
              className="p-3 bg-zinc-50 text-zinc-300 hover:bg-rose-50 hover:text-rose-600 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Sparkles({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
