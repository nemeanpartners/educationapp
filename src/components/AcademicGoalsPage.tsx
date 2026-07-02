import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BookOpenCheck, Calendar, Check, GraduationCap, Plus, Target, Trash2, TrendingUp } from 'lucide-react';
import { useAcademicGoalsStore } from '../hooks/use-academic-goals-store';
import { cn } from '../lib/utils';

const subjects = ['General', 'English', 'Maths', 'Science', 'Humanities', 'Languages', 'Arts', 'Technology'];
const categories = ['Assignment', 'Exam prep', 'Homework', 'Reading', 'Revision', 'Class participation'];

export default function AcademicGoalsPage() {
  const { goals, addGoal, updateGoal, deleteGoal } = useAcademicGoalsStore();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(subjects[0]);
  const [category, setCategory] = useState(categories[0]);
  const [target, setTarget] = useState(5);
  const [unit, setUnit] = useState('tasks');
  const [dueDate, setDueDate] = useState('');

  const completedGoals = goals.filter((goal) => goal.current >= goal.target);
  const activeGoals = goals.filter((goal) => goal.current < goal.target);
  const totalTarget = goals.reduce((sum, goal) => sum + Math.max(goal.target, 0), 0);
  const totalCurrent = goals.reduce((sum, goal) => sum + Math.min(goal.current, goal.target), 0);
  const overallProgress = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

  const waveform = useMemo(() => {
    const goalBoost = Math.min(32, goals.length * 4);
    const completeBoost = Math.min(34, completedGoals.length * 8);
    const progressBoost = Math.min(30, Math.round(overallProgress / 3));
    const base = 14 + goalBoost + completeBoost + progressBoost;

    return Array.from({ length: 28 }, (_, index) => {
      const wave = Math.sin((index + 1) * 0.9) * 14;
      const echo = Math.cos((index + 1) * 0.37 + goals.length) * 8;
      return Math.max(12, Math.min(100, Math.round(base + wave + echo)));
    });
  }, [goals.length, completedGoals.length, overallProgress]);

  const handleAddGoal = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    addGoal({
      title: cleanTitle,
      subject,
      category,
      target: Math.max(1, Number(target) || 1),
      current: 0,
      unit: unit.trim() || 'tasks',
      dueDate: dueDate || undefined,
    });
    setTitle('');
    setTarget(5);
    setUnit('tasks');
    setDueDate('');
  };

  const addProgress = (id: string, current: number, goalTarget: number) => {
    const nextCurrent = Math.min(goalTarget, current + 1);
    updateGoal(id, {
      current: nextCurrent,
      completedAt: nextCurrent >= goalTarget ? new Date().toISOString() : undefined,
    });
  };

  const finishGoal = (id: string, goalTarget: number) => {
    updateGoal(id, {
      current: goalTarget,
      completedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-8 p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <Target className="h-7 w-7 text-emerald-500" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900">Academic Goals</h1>
          <p className="mt-2 max-w-2xl text-zinc-500">Set school goals, build progress, and watch your learning waveform grow as goals are added and completed.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Active', value: activeGoals.length, icon: Target },
            { label: 'Finished', value: completedGoals.length, icon: Check },
            { label: 'Progress', value: `${overallProgress}%`, icon: TrendingUp },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center shadow-sm">
              <stat.icon className="mx-auto mb-1 h-4 w-4 text-emerald-500" />
              <div className="text-xl font-black text-zinc-900">{stat.value}</div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-sky-200/45 bg-white/35 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_24px_70px_rgba(14,116,144,0.14)] backdrop-blur-2xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-zinc-900">Goal Waveform</h2>
              <p className="text-sm text-zinc-500">The waveform reacts to goal count, completion, and total progress.</p>
            </div>
            <div className="rounded-full border border-white/70 bg-white/50 px-3 py-1 text-xs font-black text-slate-500 backdrop-blur-xl">
              {goals.length} goals
            </div>
          </div>

          <div className="flex h-64 items-center gap-2 rounded-3xl border border-white/70 bg-white/35 px-4 shadow-inner shadow-sky-100/70 backdrop-blur-xl">
            {waveform.map((height, index) => (
              <motion.div
                key={`${height}-${index}`}
                initial={{ height: 12, opacity: 0.4 }}
                animate={{ height: `${height}%`, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                whileHover={{ scaleY: 1.08 }}
                className="group relative flex-1 rounded-full bg-gradient-to-t from-sky-500 via-emerald-400 to-amber-200 shadow-[0_8px_22px_rgba(14,165,233,0.18)]"
              >
                <span className="absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded-full bg-zinc-900 px-2 py-1 text-[10px] font-black text-white group-hover:block">
                  {height}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-black text-zinc-900">Add a Goal</h2>
          <div className="space-y-4">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Improve algebra test score"
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:bg-white"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select value={subject} onChange={(event) => setSubject(event.target.value)} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold outline-none">
                {subjects.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold outline-none">
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[0.8fr_1.2fr]">
              <input
                type="number"
                min={1}
                value={target}
                onChange={(event) => setTarget(Number(event.target.value))}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold outline-none"
              />
              <input
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="tasks, chapters, practice sets"
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold outline-none"
              />
            </div>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold outline-none"
            />
            <button onClick={handleAddGoal} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              Add Academic Goal
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {goals.length === 0 && (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm font-semibold text-zinc-500 lg:col-span-2">
            Add your first school goal to activate the waveform.
          </div>
        )}
        {goals.map((goal) => {
          const isComplete = goal.current >= goal.target;
          const progress = Math.round((Math.min(goal.current, goal.target) / goal.target) * 100);
          return (
            <motion.div
              key={goal.id}
              layout
              className={cn(
                "rounded-3xl border bg-white p-5 shadow-sm",
                isComplete ? "border-emerald-200 bg-emerald-50/50" : "border-zinc-200"
              )}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-black text-sky-700">{goal.subject || 'General'}</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">{goal.category || 'Academic'}</span>
                  </div>
                  <h3 className="text-lg font-black text-zinc-900">{goal.title}</h3>
                  {goal.dueDate && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-zinc-400">
                      <Calendar className="h-3.5 w-3.5" />
                      Due {goal.dueDate}
                    </p>
                  )}
                </div>
                <button onClick={() => deleteGoal(goal.id)} className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between text-xs font-black text-zinc-500">
                  <span>{goal.current}/{goal.target} {goal.unit}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => addProgress(goal.id, goal.current, goal.target)}
                  disabled={isComplete}
                  className="flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <BookOpenCheck className="h-4 w-4" />
                  Add progress
                </button>
                <button
                  onClick={() => finishGoal(goal.id, goal.target)}
                  disabled={isComplete}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <GraduationCap className="h-4 w-4" />
                  Finish goal
                </button>
              </div>
            </motion.div>
          );
        })}
      </section>
    </div>
  );
}
