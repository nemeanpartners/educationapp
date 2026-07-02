import { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Sparkles, 
  Loader2, 
  AlertCircle,
  Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  orderBy,
  serverTimestamp
} from '@/lib/portal-firestore';
import { geminiGenerateContent } from '../services/geminiProxy';
import { cn } from '../lib/utils';
import { TodoTask } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useResponsiveDevice } from '../hooks/use-responsive-device';

export default function TodoListPage() {
  const { isPhone } = useResponsiveDevice();
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState(false);

  useEffect(() => {
    let unsubscribe = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const q = query(
          collection(db, 'todos'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          const taskList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as TodoTask[];
          setTasks(taskList);
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'todos');
          setLoading(false);
        });
      } else {
        setLoading(false);
        setTasks([]);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribe();
    };
  }, []);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.completed === b.completed) return 0;
      return a.completed ? 1 : -1;
    });
  }, [tasks]);

  const progress = useMemo(() => {
    if (tasks.length === 0) return 0;
    const completedCount = tasks.filter(t => t.completed).length;
    return Math.round((completedCount / tasks.length) * 100);
  }, [tasks]);
  const completedTasksCount = tasks.filter((task) => task.completed).length;
  const activeTasksCount = tasks.length - completedTasksCount;

  const addTask = async (text: string) => {
    const user = auth.currentUser;
    if (!user || !text.trim()) return;

    setIsAdding(true);
    try {
      await addDoc(collection(db, 'todos'), {
        userId: user.uid,
        text: text.trim(),
        completed: false,
        createdAt: serverTimestamp()
      });
      setNewTaskText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'todos');
    } finally {
      setIsAdding(false);
    }
  };

  const toggleTask = async (task: TodoTask) => {
    try {
      await updateDoc(doc(db, 'todos', task.id), {
        completed: !task.completed
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `todos/${task.id}`);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'todos', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `todos/${id}`);
    }
  };

  const generateAITasks = async () => {
    if (!aiPrompt.trim()) return;
    setIsAIGenerating(true);

    try {
      const result = await geminiGenerateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a checklist of tasks for this goal: "${aiPrompt}". Return a JSON array of strings, each being a short task.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: { type: "string" }
          }
        }
      });
      const taskStrings = JSON.parse(result.text || '[]') as string[];
      
      const user = auth.currentUser;
      if (user) {
        for (const text of taskStrings) {
          await addDoc(collection(db, 'todos'), {
            userId: user.uid,
            text,
            completed: false,
            createdAt: serverTimestamp()
          });
        }
      }
      setAiPrompt('');
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setIsAIGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className={cn("mx-auto max-w-6xl", isPhone ? "p-4" : "p-8")}>
      <div className={cn(isPhone ? "space-y-5" : "space-y-8")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-[28px] border border-white/70 bg-white/38 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_20px_48px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  <h2 className="text-base font-black text-zinc-900">AI Task Generator</h2>
                </div>
                <p className="text-xs font-semibold leading-6 text-zinc-500">Create a clean checklist from one study goal or assignment prompt.</p>
              </div>
              <div className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">
                Smart assist
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., plan a history essay"
                className="min-h-[96px] flex-1 rounded-2xl border border-white/70 bg-white/65 px-4 py-3 text-sm font-medium text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-200 resize-none"
              />
              <button
                onClick={generateAITasks}
                disabled={!aiPrompt.trim() || isAIGenerating}
                className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 disabled:opacity-50"
              >
                {isAIGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate List
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/38 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_20px_48px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <h2 className="text-base font-black text-zinc-900">Your Progress</h2>
                </div>
                <p className="text-xs font-semibold leading-6 text-zinc-500">See how much of today’s task load is already closed out.</p>
              </div>
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">
                {progress}% done
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[0.95fr_1.05fr] sm:items-center">
              <div className="relative inline-flex items-center justify-center">
                <svg className="h-28 w-28 -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="46"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="transparent"
                    className="text-white/70"
                  />
                  <motion.circle
                    cx="56"
                    cy="56"
                    r="46"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={289}
                    initial={{ strokeDashoffset: 289 }}
                    animate={{ strokeDashoffset: 289 - (289 * progress) / 100 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="text-indigo-600"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl font-black text-zinc-900">{progress}%</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Progress</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total', value: tasks.length },
                  { label: 'Active', value: activeTasksCount },
                  { label: 'Done', value: completedTasksCount },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/70 bg-white/70 px-3 py-4 text-center">
                    <div className="text-xl font-black text-zinc-900">{stat.value}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={cn("grid grid-cols-1 lg:grid-cols-3", isPhone ? "gap-5" : "gap-8")}>
        {/* Main List Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className={cn("bg-white border border-zinc-200 shadow-sm", isPhone ? "rounded-[24px] p-5" : "rounded-[32px] p-8")}>
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="h-6 w-6 text-indigo-600" />
              <h1 className="text-2xl font-black text-zinc-900 tracking-tight">My To-do List</h1>
            </div>
            <p className="text-zinc-500 text-sm mb-8">Stay organized and focused on what matters most.</p>

            {/* Add Task Input */}
            <div className={cn("mb-8 flex gap-3", isPhone && "flex-col")}>
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask(newTaskText)}
                placeholder="Add a new task..."
                className="flex-1 px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
              />
              <button
                onClick={() => addTask(newTaskText)}
                disabled={!newTaskText.trim() || isAdding}
                className="px-6 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              </button>
            </div>

            {/* Task List */}
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {sortedTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border transition-all group",
                      task.completed 
                        ? "bg-zinc-50 border-zinc-100 opacity-60" 
                        : "bg-white border-zinc-200 hover:border-indigo-200 hover:shadow-md"
                    )}
                  >
                    <button
                      onClick={() => toggleTask(task)}
                      className={cn(
                        "shrink-0 transition-colors",
                        task.completed ? "text-indigo-600" : "text-zinc-300 hover:text-indigo-400"
                      )}
                    >
                      {task.completed ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                    </button>
                    
                    <span className={cn(
                      "flex-1 text-sm font-medium transition-all",
                      task.completed && "line-through text-zinc-400"
                    )}>
                      {task.text}
                    </span>

                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {tasks.length === 0 && (
                <div className="text-center py-12">
                  <div className="h-16 w-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-8 w-8 text-zinc-200" />
                  </div>
                  <p className="text-zinc-400 text-sm">No tasks yet. Add one to get started!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-8">
          <div className="rounded-[32px] border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-black text-zinc-900">Task Momentum</h2>
            </div>
            <p className="text-zinc-500 text-xs leading-6">
              Keep the list small and visible. Finishing one active item is usually better than opening five new ones at once.
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
