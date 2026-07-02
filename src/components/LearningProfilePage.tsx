import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock,
  Lightbulb,
  ListChecks,
  Map,
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { detectStudentPortalFromPath, studentPortalToolPath } from '@/lib/portal';

type LearningProfile = {
  primaryMethod: string;
  challenge: string;
  focusLength: string;
  supportTools: string[];
  updatedAt: string;
};

const methodOptions = [
  {
    id: 'practice',
    label: 'Practice questions',
    description: 'I learn by trying questions, checking answers, and improving.',
    tools: ['Practice Quiz', 'Question Breakdown', 'Quiz Game'],
  },
  {
    id: 'visual',
    label: 'Visual maps',
    description: 'I learn when ideas are shown as diagrams, colour, or relationships.',
    tools: ['Mind Maps', 'Class Notes', 'Formula Explainer'],
  },
  {
    id: 'explain',
    label: 'Explain it back',
    description: 'I learn by putting ideas into my own words.',
    tools: ['Study Buddy', 'Flashcards', 'Question Breakdown'],
  },
  {
    id: 'memory',
    label: 'Memory drills',
    description: 'I need repetition, recall, and spaced review.',
    tools: ['Flashcards', 'Practice Quiz', 'Homework Planner'],
  },
];

const challengeOptions = [
  { id: 'starting', label: 'Starting work', recommendation: 'Use a tiny first task and a short timer before opening a bigger plan.' },
  { id: 'remembering', label: 'Remembering content', recommendation: 'Use flashcards, blurting, and quick quizzes over several days.' },
  { id: 'understanding', label: 'Understanding concepts', recommendation: 'Use worked examples, explain-back notes, and question breakdowns.' },
  { id: 'focus', label: 'Staying focused', recommendation: 'Use shorter study blocks with visible breaks and fewer open tools.' },
  { id: 'exam', label: 'Exam pressure', recommendation: 'Use practice quizzes, timed mock exams, and review weak spots first.' },
];

const focusOptions = ['15 minutes', '25 minutes', '40 minutes', '60 minutes'];

function readProfile(): LearningProfile | null {
  try {
    const stored = window.localStorage.getItem('learning-profile');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export default function LearningProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const savedProfile = useMemo(readProfile, []);
  const [primaryMethod, setPrimaryMethod] = useState(savedProfile?.primaryMethod || methodOptions[0].id);
  const [challenge, setChallenge] = useState(savedProfile?.challenge || challengeOptions[0].id);
  const [focusLength, setFocusLength] = useState(savedProfile?.focusLength || focusOptions[1]);
  const [saved, setSaved] = useState(Boolean(savedProfile));

  const selectedMethod = methodOptions.find((option) => option.id === primaryMethod) || methodOptions[0];
  const selectedChallenge = challengeOptions.find((option) => option.id === challenge) || challengeOptions[0];

  const profile: LearningProfile = {
    primaryMethod,
    challenge,
    focusLength,
    supportTools: selectedMethod.tools,
    updatedAt: new Date().toISOString(),
  };

  const saveProfile = () => {
    window.localStorage.setItem('learning-profile', JSON.stringify(profile));
    setSaved(true);
  };

  const resetProfile = () => {
    window.localStorage.removeItem('learning-profile');
    setPrimaryMethod(methodOptions[0].id);
    setChallenge(challengeOptions[0].id);
    setFocusLength(focusOptions[1]);
    setSaved(false);
  };

  return (
    <div className="min-h-full bg-[#f7f8fb] p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="rounded-[32px] border border-white/70 bg-white/65 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-2xl lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Brain size={28} />
              </div>
              <h1 className="text-4xl font-black tracking-tight text-zinc-950">Learning Profile</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-zinc-500">
                Work out how you learn best, then use that profile to plan homework, choose tools, and track what actually improves.
              </p>
            </div>
            {saved ? (
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-emerald-800">
                <p className="flex items-center gap-2 text-sm font-black">
                  <CheckCircle2 size={18} />
                  Profile saved
                </p>
                <p className="mt-1 text-xs font-bold opacity-80">Your planner and progress page can use this.</p>
              </div>
            ) : null}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[32px] border border-white/70 bg-white/70 p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <Sparkles className="text-emerald-600" />
              <h2 className="text-2xl font-black text-zinc-950">Build my study profile</h2>
            </div>

            <div className="space-y-7">
              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-400">I learn best through</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {methodOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPrimaryMethod(option.id)}
                      className={cn(
                        'rounded-3xl border p-4 text-left transition',
                        primaryMethod === option.id
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                          : 'border-zinc-100 bg-white text-zinc-700 hover:border-emerald-200',
                      )}
                    >
                      <p className="font-black">{option.label}</p>
                      <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-400">My biggest study blocker is</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {challengeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setChallenge(option.id)}
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-left text-sm font-black transition',
                        challenge === option.id
                          ? 'border-violet-300 bg-violet-50 text-violet-900'
                          : 'border-zinc-100 bg-white text-zinc-700 hover:border-violet-200',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-400">Best focus block</p>
                <div className="flex flex-wrap gap-2">
                  {focusOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFocusLength(option)}
                      className={cn(
                        'rounded-full border px-4 py-2 text-sm font-black transition',
                        focusLength === option
                          ? 'border-zinc-950 bg-zinc-950 text-white'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400',
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={saveProfile}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700"
                >
                  Save Learning Profile
                  <ArrowRight size={17} />
                </button>
                <button
                  type="button"
                  onClick={resetProfile}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-600 transition hover:bg-zinc-50"
                >
                  <RotateCcw size={17} />
                  Reset
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[32px] border border-white/70 bg-zinc-950 p-6 text-white shadow-sm">
              <p className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-200">
                <Lightbulb size={17} />
                Recommended approach
              </p>
              <h2 className="text-3xl font-black">{selectedMethod.label}</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-zinc-300">{selectedChallenge.recommendation}</p>
              <div className="mt-5 rounded-3xl bg-white/10 p-4">
                <p className="flex items-center gap-2 text-sm font-black">
                  <Clock size={17} />
                  Use {focusLength} blocks first
                </p>
                <p className="mt-2 text-xs font-semibold leading-5 text-zinc-300">
                  Your planner should start with this block length before increasing the session.
                </p>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/70 bg-white/70 p-6 shadow-sm">
              <p className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400">
                <ListChecks size={17} />
                Tools that match me
              </p>
              <div className="space-y-3">
                {selectedMethod.tools.map((tool) => (
                  <div key={tool} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3">
                    <span className="text-sm font-black text-zinc-900">{tool}</span>
                    <CheckCircle2 size={17} className="text-emerald-500" />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate(studentPortalToolPath(activePortal, 'homework-planner'))}
                className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-left text-emerald-950 transition hover:bg-emerald-100"
              >
                <Target className="mb-3 text-emerald-600" />
                <p className="font-black">Plan homework with this</p>
                <p className="mt-1 text-xs font-semibold text-emerald-700">Use your profile in your weekly study plan.</p>
              </button>
              <button
                type="button"
                onClick={() => navigate(studentPortalToolPath(activePortal, 'progress'))}
                className="rounded-3xl border border-violet-100 bg-violet-50 p-5 text-left text-violet-950 transition hover:bg-violet-100"
              >
                <Map className="mb-3 text-violet-600" />
                <p className="font-black">Track impact</p>
                <p className="mt-1 text-xs font-semibold text-violet-700">See whether your chosen methods are helping.</p>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
