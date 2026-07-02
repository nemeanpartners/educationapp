import { useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Highlighter,
  Loader2,
  RotateCcw,
  Send,
  Sigma,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { geminiService, MathSolverResponse, MathSolverStep } from '../services/gemini';
import { detectStudentPortalFromPath, studentPortalToolPath } from '../lib/portal';
import { getMathSolverPreset, getStudySuggestions, recordStudySuggestionUsage } from '../lib/study-presets';

const modes = [
  'Auto',
  'Algebra',
  'Calculus',
  'Graphing',
  'Statistics',
  'Linear algebra',
  'Trigonometry',
];

const levels = ['Middle school', 'High school', 'University', 'Exam revision'];

function renderMath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    return katex.renderToString(trimmed, {
      throwOnError: false,
      displayMode: true,
      strict: false,
    });
  } catch {
    return '';
  }
}

function StepMath({ value }: { value: string }) {
  const html = useMemo(() => renderMath(value), [value]);

  if (!html) {
    return <pre className="whitespace-pre-wrap break-words font-mono text-sm font-bold leading-7 text-slate-900">{value}</pre>;
  }

  return <div className="overflow-x-auto text-slate-900" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function MathSolverPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const [problem, setProblem] = useState('Solve 2x^2 - 5x - 3 = 0');
  const [mode, setMode] = useState('Auto');
  const [level, setLevel] = useState('High school');
  const [solution, setSolution] = useState<MathSolverResponse | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [question, setQuestion] = useState('');
  const [stepAnswer, setStepAnswer] = useState('');
  const [isSolving, setIsSolving] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestionLibrary, setShowSuggestionLibrary] = useState(false);

  const selectedStep: MathSolverStep | null = selectedStepIndex !== null && solution
    ? solution.steps[selectedStepIndex]
    : null;
  const mathSuggestions = useMemo(() => getStudySuggestions('math'), [solution?.normalizedProblem]);
  const topMathSuggestions = mathSuggestions.slice(0, 4);

  const wolframUrl = useMemo(() => {
    const url = new URL('https://www.wolframalpha.com/input');
    url.searchParams.set('i', problem || 'solve 2x^2 - 5x - 3 = 0');
    return url.toString();
  }, [problem]);

  const solve = async (nextProblem = problem) => {
    if (!nextProblem.trim()) {
      setError('Enter an equation, expression, derivative, integral, limit, or word problem first.');
      return;
    }

    setIsSolving(true);
    setError(null);
    setStepAnswer('');
    setSelectedStepIndex(null);

    try {
      const nextSolution = getMathSolverPreset(nextProblem) || await geminiService.solveMathProblem(nextProblem, mode, level);
      if (!Array.isArray(nextSolution.steps) || nextSolution.steps.length === 0) {
        throw new Error('The solver returned an incomplete answer. Try adding more detail to the problem.');
      }
      setProblem(nextProblem);
      setSolution(nextSolution);
      setSelectedStepIndex(0);
      recordStudySuggestionUsage('math', nextProblem);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not solve that problem.');
    } finally {
      setIsSolving(false);
    }
  };

  const askAboutStep = async () => {
    if (!selectedStep || !question.trim()) return;

    setIsAsking(true);
    setError(null);

    try {
      const answer = await geminiService.explainMathStep(problem, selectedStep, question);
      setStepAnswer(answer);
      setQuestion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not answer that step question.');
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="relative isolate -m-8 min-h-[calc(100vh-80px)] overflow-hidden bg-[#f7f8fb] p-4 sm:p-6 lg:p-10">
      <div className="pointer-events-none absolute left-[5%] top-14 h-64 w-64 rounded-full bg-cyan-300/35 blur-3xl" />
      <div className="pointer-events-none absolute right-[9%] top-28 h-80 w-80 rounded-full bg-emerald-300/25 blur-[80px]" />
      <div className="pointer-events-none absolute bottom-14 left-[25%] h-56 w-80 rounded-full bg-amber-300/25 blur-[70px]" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/45 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/50 text-cyan-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <Sigma size={30} />
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950">Math Solver</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
                A fast Solver On-The-Go-style workspace for equations, calculus, graphing prompts, systems, limits, and proofs with checked steps.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate(studentPortalToolPath(activePortal, 'calculator'))}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/45 px-4 py-3 text-sm font-black text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:bg-white/70"
              >
                <Sigma size={16} />
                Open Calculator
              </button>
              <a
                href={wolframUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/45 px-4 py-3 text-sm font-black text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:bg-white/70"
              >
                Open in Wolfram Alpha
                <ExternalLink size={16} />
              </a>
              <button
                type="button"
                onClick={() => {
                  setProblem('');
                  setSolution(null);
                  setSelectedStepIndex(null);
                  setStepAnswer('');
                  setError(null);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/45 px-4 py-3 text-sm font-black text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:bg-white/70"
              >
                <RotateCcw size={16} />
                Clear
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-white/70 bg-white/45 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/50 text-cyan-600">
                <Wand2 size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">Enter a problem</h2>
                <p className="text-sm font-medium text-slate-500">Type naturally or paste formal notation.</p>
              </div>
            </div>

            <textarea
              value={problem}
              onChange={(event) => setProblem(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') solve();
              }}
              className="min-h-44 w-full resize-none rounded-3xl border border-white/70 bg-white/60 px-5 py-4 font-mono text-base font-bold leading-7 text-slate-950 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_28px_rgba(15,23,42,0.05)] focus:ring-2 focus:ring-cyan-500"
              placeholder="Example: Solve x^2 - 5x + 6 = 0 and explain each step"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Mode</label>
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {modes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Level</label>
                <select
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {levels.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => solve()}
              disabled={isSolving || !problem.trim()}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-cyan-200 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSolving ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
              Solve with AI
            </button>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Suggested problems</p>
                <button
                  type="button"
                  onClick={() => setShowSuggestionLibrary(true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/55 text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600"
                  aria-label="Open full math suggestion list"
                >
                  <Sparkles size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {topMathSuggestions.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => solve(example)}
                    className="rounded-full border border-white/70 bg-white/55 px-4 py-2 text-xs font-bold text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:bg-white"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm font-bold text-rose-700">
                {error}
              </p>
            )}
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/45 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl sm:p-6">
            {!solution ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/45 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-50 text-cyan-600">
                  <BrainCircuit size={34} />
                </div>
                <h2 className="mt-5 text-2xl font-black text-slate-950">Ready for complex equations</h2>
                <p className="mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">
                  Results will appear as a checked answer, assumptions, step cards, and a selected-step tutor chat.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-3xl border border-white/70 bg-white/60 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{solution.problemType}</p>
                      <h2 className="mt-2 text-2xl font-black text-slate-950">Answer</h2>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">
                      <CheckCircle2 size={15} />
                      Verified
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-slate-950 px-4 py-4 text-white">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Exact</p>
                    <p className="mt-2 break-words font-mono text-2xl font-black">{solution.exactAnswer}</p>
                    {solution.decimalAnswer && (
                      <p className="mt-2 break-words font-mono text-sm font-bold text-slate-300">Decimal: {solution.decimalAnswer}</p>
                    )}
                  </div>
                  <p className="mt-4 text-sm font-bold text-slate-600">
                    Normalized: <span className="font-mono text-slate-950">{solution.normalizedProblem}</span>
                  </p>
                </div>

                {solution.assumptions.length > 0 && (
                  <div className="rounded-3xl border border-white/70 bg-white/55 p-5">
                    <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Assumptions</h3>
                    <ul className="mt-3 space-y-2">
                      {solution.assumptions.map((item, index) => (
                        <li key={`${item}-${index}`} className="text-sm font-semibold leading-6 text-slate-600">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-black text-slate-950">Steps</h3>
                      <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Select to ask
                      </span>
                    </div>
                    <div className="max-h-[520px] space-y-3 overflow-y-auto pr-2">
                      {solution.steps.map((step, index) => (
                        <button
                          key={`${step.title}-${index}`}
                          type="button"
                          onClick={() => {
                            setSelectedStepIndex(index);
                            setStepAnswer('');
                          }}
                          className={cn(
                            'w-full rounded-3xl border p-4 text-left transition',
                            selectedStepIndex === index
                              ? 'border-cyan-300 bg-cyan-50/80 shadow-[0_16px_40px_rgba(8,145,178,0.16)]'
                              : 'border-white/70 bg-white/55 hover:bg-white/80',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-xs font-black text-white">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <h4 className="font-black text-slate-950">{step.title}</h4>
                              <div className="mt-2 rounded-2xl bg-white/65 p-3">
                                <StepMath value={step.work} />
                              </div>
                              <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{step.explanation}</p>
                              <p className="mt-2 text-xs font-bold leading-5 text-emerald-700">{step.check}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <aside className="rounded-3xl border border-white/70 bg-white/55 p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                        <Highlighter size={20} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-950">Ask about a highlighted step</h3>
                        <p className="text-xs font-bold text-slate-500">Select a step on the left first.</p>
                      </div>
                    </div>

                    {selectedStep ? (
                      <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
                          Step {(selectedStepIndex ?? 0) + 1}
                        </p>
                        <p className="mt-1 font-black text-slate-950">{selectedStep.title}</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-100 bg-white/60 p-4 text-sm font-bold text-slate-500">
                        No step selected.
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <input
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') askAboutStep();
                        }}
                        disabled={!selectedStep || isAsking}
                        className="min-w-0 flex-1 rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                        placeholder="Why did this step work?"
                      />
                      <button
                        type="button"
                        onClick={askAboutStep}
                        disabled={!selectedStep || !question.trim() || isAsking}
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Ask about selected step"
                      >
                        {isAsking ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                      </button>
                    </div>

                    {stepAnswer && (
                      <div className="mt-4 rounded-3xl border border-white/70 bg-white/75 p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950">
                          <Bot size={18} className="text-cyan-600" />
                          Tutor answer
                        </div>
                        <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">{stepAnswer}</p>
                      </div>
                    )}

                    {solution.followUpQuestions.length > 0 && (
                      <div className="mt-5">
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Try asking</p>
                        <div className="space-y-2">
                          {solution.followUpQuestions.map((item, index) => (
                            <button
                              key={`${item}-${index}`}
                              type="button"
                              onClick={() => setQuestion(item)}
                              className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-left text-xs font-bold leading-5 text-slate-600 transition hover:bg-white"
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </aside>
                </div>

                <div className="rounded-3xl border border-white/70 bg-white/55 p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950">
                    <Clipboard size={18} className="text-emerald-600" />
                    Verification
                  </div>
                  <p className="text-sm font-medium leading-6 text-slate-700">{solution.verification}</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {showSuggestionLibrary && (
        <div className="fixed inset-0 z-[75] bg-slate-950/45 p-4 backdrop-blur-sm sm:p-8">
          <div className="mx-auto flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h4 className="text-xl font-black text-slate-950">Math suggestion library</h4>
                <p className="text-sm font-medium text-slate-500">Use common solved prompts first so repeated questions do not waste AI calls.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSuggestionLibrary(false)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="grid gap-3 overflow-y-auto p-5 sm:grid-cols-2">
              {mathSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setShowSuggestionLibrary(false);
                    solve(suggestion);
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:border-cyan-300 hover:bg-white hover:text-cyan-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
