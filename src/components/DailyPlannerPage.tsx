import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun, 
  CloudSun, 
  Moon, 
  Sparkles, 
  Loader2, 
  Timer, 
  Coffee, 
  CheckSquare, 
  BookOpen, 
  Calendar,
  ChevronDown
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { geminiGenerateContent } from '../services/geminiProxy';
import { cn } from '../lib/utils';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from '@/lib/portal-firestore';
import { detectStudentPortalFromPath, studentPortalPath } from '@/lib/portal';

type PlanTask = {
  id: string;
  title: string;
  time?: string;
  suggestion?: string;
  completed?: boolean;
};

type TimetableEntry = {
  day?: string;
  startTime?: string;
};

export default function DailyPlannerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isUniversityPortal = detectStudentPortalFromPath(location.pathname) === 'university';
  const [plans, setPlans] = useState({ morning: '', afternoon: '', evening: '' });
  const [generatedPlans, setGeneratedPlans] = useState<{ morning: PlanTask[]; afternoon: PlanTask[]; evening: PlanTask[] }>({
    morning: [],
    afternoon: [],
    evening: [],
  });
  const [loading, setLoading] = useState({ morning: false, afternoon: false, evening: false });
  const [aiError, setAiError] = useState('');
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [openHelpCard, setOpenHelpCard] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setTimetableEntries([]);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'timetables', user.uid));
        if (snap.exists()) {
          const entries = (snap.data().entries || []) as TimetableEntry[];
          setTimetableEntries(entries);
        } else {
          setTimetableEntries([]);
        }
      } catch {
        setTimetableEntries([]);
      }
    });
    return () => unsub();
  }, []);

  const todayName = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
  }, []);

  const firstClassTime = useMemo(() => {
    const todays = timetableEntries
      .filter(e => e.day?.toLowerCase() === todayName.toLowerCase())
      .map(e => e.startTime)
      .filter((t): t is string => !!t);
    if (todays.length === 0) return '09:00';
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    return todays.sort((a, b) => toMinutes(a) - toMinutes(b))[0];
  }, [timetableEntries, todayName]);

  const toggleTask = (timeOfDay: 'morning' | 'afternoon' | 'evening', taskId: string) => {
    setGeneratedPlans(prev => ({
      ...prev,
      [timeOfDay]: prev[timeOfDay].map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      ),
    }));
  };

  const generatePlan = async (timeOfDay: 'morning' | 'afternoon' | 'evening') => {
    setLoading(prev => ({ ...prev, [timeOfDay]: true }));
    try {
      const routineWindow = timeOfDay === 'morning'
        ? `Build a routine from wake-up until the user's first class at ${firstClassTime} (if no timetable, assume 09:00).`
        : `Build a routine for the ${timeOfDay} period.`;

      const prompt = `Create a short routine with actionable tasks for the ${timeOfDay}. ${routineWindow}
User goals: "${plans[timeOfDay]}". 
Return JSON array with 4-8 items. Each item has:
- title (short task)
- time (optional, HH:mm or range)
- suggestion (short helpful note)
Keep tasks small and checkable.`;

      const tryGenerate = async (attempt: number): Promise<PlanTask[]> => {
        try {
          const response = await geminiGenerateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    time: { type: "string" },
                    suggestion: { type: "string" }
                  },
                  required: ["title"]
                }
              }
            }
          });

          const items = JSON.parse(response.text || "[]") as Array<{ title: string; time?: string; suggestion?: string }>;
          return items.map(item => ({
            id: crypto.randomUUID(),
            title: item.title,
            time: item.time,
            suggestion: item.suggestion,
            completed: false,
          }));
        } catch (err: any) {
          if ((err?.status === 503 || `${err?.message}`.includes('UNAVAILABLE')) && attempt < 2) {
            await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
            return tryGenerate(attempt + 1);
          }
          throw err;
        }
      };

      const withIds = await tryGenerate(0);
      setGeneratedPlans(prev => ({ ...prev, [timeOfDay]: withIds }));
    } catch (error: any) {
      console.error("AI Error:", error);
      if (error?.status === 503 || `${error?.message}`.includes('UNAVAILABLE')) {
        setAiError('Gemini is busy right now. Please try again in a minute.');
      } else if (error?.status === 429 || `${error?.message}`.includes('RESOURCE_EXHAUSTED')) {
        setAiError('Gemini rate limit reached. Please wait a minute and try again.');
      } else {
        setAiError('AI is unavailable right now. Please try again.');
      }
    } finally {
      setLoading(prev => ({ ...prev, [timeOfDay]: false }));
    }
  };

  const nextSteps = [
    { title: isUniversityPortal ? 'Focus' : 'Focus Mode', icon: Timer, description: isUniversityPortal ? 'Start a structured deep-work block for reading, research, or writing.' : 'Start a timer and get in the zone without distractions.', action: isUniversityPortal ? 'Start Focus' : 'Start Focusing', link: studentPortalPath(isUniversityPortal ? 'university' : 'highschool', '/timer') },
    { title: 'Take a Break', icon: Coffee, description: 'Recharge your mind with guided breaks and activities.', action: 'See Break Ideas', link: studentPortalPath(isUniversityPortal ? 'university' : 'highschool', '/study') },
    { title: 'View To-do List', icon: CheckSquare, description: 'Check your tasks and stay on top of your priorities.', action: 'Open To-do List', link: studentPortalPath(isUniversityPortal ? 'university' : 'highschool', '/todo') },
    { title: 'Homework Planner', icon: Sparkles, description: 'Generate a personalized weekly study schedule with AI.', action: 'View Weekly Planner', link: studentPortalPath(isUniversityPortal ? 'university' : 'highschool', '/homework-planner') },
    { title: 'Homework Timetable', icon: Calendar, description: 'See a visual overview of your weekly homework schedule.', action: 'View Timetable', link: studentPortalPath(isUniversityPortal ? 'university' : 'highschool', '/timetable') },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-zinc-900">Daily Planner</h1>
        <p className="mt-1 text-sm font-medium text-zinc-500">Plan your day first, then jump into the next helpful action.</p>
      </div>

      {/* Plan Your Day Section */}
      <section>
        <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-xl font-black text-zinc-900">Plan Your Day</h2>
          <p className="mb-4 text-sm font-medium text-zinc-500">Get AI-powered schedules for your morning, afternoon, and evening.</p>
          {aiError && (
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-600">
              {aiError}
            </div>
          )}

          <div className="grid gap-3">
            {(['morning', 'afternoon', 'evening'] as const).map((time) => (
              <Collapsible key={time} className="overflow-hidden rounded-2xl border border-zinc-100">
                <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-4 hover:bg-zinc-50">
                  <div className="flex items-center gap-3 text-sm font-black capitalize text-zinc-900">
                    {time === 'morning' ? <Sun className="text-amber-500" /> : time === 'afternoon' ? <CloudSun className="text-sky-500" /> : <Moon className="text-indigo-500" />}
                    {time}
                  </div>
                  <ChevronDown className="h-4 w-4 text-zinc-400" />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-5 pb-5 pt-0">
                  <textarea
                    value={plans[time]}
                    onChange={(e) => setPlans(prev => ({ ...prev, [time]: e.target.value }))}
                    placeholder={`What do you need to do this ${time}?`}
                    className="mb-3 h-20 w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => generatePlan(time)}
                    disabled={loading[time] || !plans[time].trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-2.5 text-sm font-bold text-white transition-all hover:bg-sky-600 disabled:opacity-50"
                  >
                    {loading[time] ? <Loader2 className="animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Generate {time.charAt(0).toUpperCase() + time.slice(1)} Plan
                  </button>
                  {generatedPlans[time].length > 0 && (
                    <div className="mt-4 space-y-3">
                      {generatedPlans[time].map((task) => (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all",
                            task.completed ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-white"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={!!task.completed}
                            onChange={() => toggleTask(time, task.id)}
                            className="mt-1 h-4 w-4"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className={cn("text-sm font-bold text-zinc-900", task.completed && "text-emerald-700 line-through")}>
                                {task.title}
                              </p>
                              {task.time && (
                                <span className="text-xs font-bold text-zinc-500">{task.time}</span>
                              )}
                            </div>
                            {task.suggestion && (
                              <p className="mt-1 text-xs text-zinc-500">{task.suggestion}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      </section>

      {/* Next Steps Section */}
      <section className="space-y-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-zinc-900">Next Steps</h2>
            <p className="text-sm font-medium text-zinc-500">Quick actions for focus, breaks, tasks, and homework planning.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {nextSteps.map((step) => (
            <Card
              key={step.title}
              className="group relative aspect-square cursor-pointer rounded-3xl border-none shadow-md transition-all hover:-translate-y-1 hover:shadow-xl"
              onClick={() => navigate(step.link)}
            >
              <CardContent className="flex h-full flex-col justify-between p-4">
                <button
                  type="button"
                  aria-label={`${step.title} details`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenHelpCard(openHelpCard === step.title ? null : step.title);
                  }}
                  onMouseEnter={() => setOpenHelpCard(step.title)}
                  onMouseLeave={() => setOpenHelpCard(null)}
                  className="absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-xs font-black text-zinc-500 transition hover:bg-indigo-100 hover:text-indigo-700"
                >
                  ?
                </button>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <step.icon className="h-6 w-6" />
                </div>

                <div>
                  <h3 className="text-base font-black leading-tight text-zinc-900">{step.title}</h3>
                  <div className="mt-3 flex items-center gap-1 text-xs font-bold text-indigo-600">
                    {step.action} →
                  </div>
                </div>

                {openHelpCard === step.title && (
                  <div
                    className="absolute left-3 right-3 top-11 z-30 rounded-2xl border border-zinc-200 bg-white p-3 text-xs font-semibold leading-5 text-zinc-600 shadow-xl"
                    onClick={(event) => event.stopPropagation()}
                    onMouseEnter={() => setOpenHelpCard(step.title)}
                    onMouseLeave={() => setOpenHelpCard(null)}
                  >
                    {step.description}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
