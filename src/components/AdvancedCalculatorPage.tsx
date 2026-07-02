import { useMemo, useState } from 'react';
import { Calculator, Divide, ExternalLink, FunctionSquare, RotateCcw, Sigma } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { detectStudentPortalFromPath, studentPortalToolPath } from '../lib/portal';

const quickKeys = [
  '7', '8', '9', '/',
  '4', '5', '6', '*',
  '1', '2', '3', '-',
  '0', '.', '^', '+',
  '(', ')', 'pi', 'e',
  'sin(', 'cos(', 'tan(', 'sqrt(',
  'ln(', 'log(', 'abs(', ',',
];

const examples = [
  '2 + 2 * 5',
  'sqrt(144) + 3^2',
  'sin(pi / 2)',
  'log(1000) + ln(e^3)',
  'max(4, 12, 8) - min(4, 12, 8)',
];

const allowedIdentifiers: Record<string, string> = {
  pi: 'Math.PI',
  e: 'Math.E',
  sin: 'Math.sin',
  cos: 'Math.cos',
  tan: 'Math.tan',
  asin: 'Math.asin',
  acos: 'Math.acos',
  atan: 'Math.atan',
  sqrt: 'Math.sqrt',
  abs: 'Math.abs',
  ln: 'Math.log',
  log: 'Math.log10',
  exp: 'Math.exp',
  floor: 'Math.floor',
  ceil: 'Math.ceil',
  round: 'Math.round',
  min: 'Math.min',
  max: 'Math.max',
  pow: 'Math.pow',
};

function formatResult(value: number) {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) < 1e-12) return '0';
  return Number(value.toPrecision(12)).toString();
}

function evaluateExpression(input: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Enter a calculation first.');
  if (!/^[0-9+\-*/%^().,\sA-Za-z]+$/.test(trimmed)) {
    throw new Error('Only numbers, operators, brackets, commas, constants, and supported functions are allowed.');
  }

  const unsupported = trimmed
    .match(/[A-Za-z]+/g)
    ?.filter((identifier) => !allowedIdentifiers[identifier.toLowerCase()]);

  if (unsupported?.length) {
    throw new Error(`Unsupported term: ${unsupported[0]}`);
  }

  const normalized = trimmed
    .replace(/\^/g, '**')
    .replace(/[A-Za-z]+/g, (identifier) => allowedIdentifiers[identifier.toLowerCase()]);

  const result = Function(`"use strict"; return (${normalized});`)();
  if (typeof result !== 'number' || Number.isNaN(result)) {
    throw new Error('This calculation did not produce a number.');
  }

  return result;
}

export default function AdvancedCalculatorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const [expression, setExpression] = useState('2 + 2');
  const [result, setResult] = useState('4');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ expression: string; result: string }>>([]);
  const [graphExpression, setGraphExpression] = useState('y=x^2');

  const desmosUrl = useMemo(() => {
    const url = new URL('https://www.desmos.com/calculator');
    url.searchParams.set('embed', '1');
    return url.toString();
  }, []);

  const calculate = (nextExpression = expression) => {
    try {
      const value = evaluateExpression(nextExpression);
      const formatted = formatResult(value);
      setExpression(nextExpression);
      setResult(formatted);
      setError(null);
      setHistory((current) => [{ expression: nextExpression, result: formatted }, ...current].slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not evaluate that expression.');
    }
  };

  const appendKey = (key: string) => {
    setExpression((current) => `${current}${key}`);
  };

  return (
    <div className="relative isolate -m-8 min-h-[calc(100vh-80px)] overflow-hidden bg-[#f4f5f7] p-6 sm:p-8 lg:p-12">
      <div className="pointer-events-none absolute left-[7%] top-16 h-56 w-56 rounded-full bg-sky-300/45 blur-3xl" />
      <div className="pointer-events-none absolute right-[12%] top-20 h-72 w-72 rounded-full bg-emerald-300/30 blur-[72px]" />
      <div className="pointer-events-none absolute bottom-16 left-[24%] h-48 w-72 rounded-full bg-amber-300/35 blur-[64px]" />
      <div className="pointer-events-none absolute bottom-24 right-[20%] h-52 w-52 rounded-full bg-violet-300/30 blur-[70px]" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-8">
        <header className="rounded-[2rem] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/60 bg-white/35 text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
                <Calculator size={30} />
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight text-zinc-900">Advanced Calculator</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-zinc-600">
                Run simple arithmetic, advanced functions, powers, constants, and graph equations with Desmos.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate(studentPortalToolPath(activePortal, 'math-solver'))}
                className="inline-flex items-center justify-center rounded-full border border-white/55 bg-white/35 px-5 py-3 text-sm font-black text-cyan-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl transition hover:bg-white/55"
              >
                Open Math Solver
              </button>
              <div className="rounded-full border border-white/55 bg-white/30 px-5 py-3 text-sm font-black text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
                Local calculator + Desmos graphing
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/55 bg-white/30 text-emerald-600 backdrop-blur-xl">
                <Sigma size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-zinc-900">Calculate</h2>
                <p className="text-sm font-medium text-zinc-500">Use operators, brackets, functions, pi, and e.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/55 bg-white/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_10px_26px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <label htmlFor="calculation" className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                Expression
              </label>
              <textarea
                id="calculation"
                value={expression}
                onChange={(event) => setExpression(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') calculate();
                }}
                className="mt-3 min-h-28 w-full resize-none rounded-2xl border border-white/55 bg-white/40 px-4 py-3 font-mono text-lg font-bold text-zinc-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl focus:ring-2 focus:ring-emerald-500"
              />
              <div className="mt-4 rounded-2xl border border-white/55 bg-white/45 p-4 backdrop-blur-xl">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Result</p>
                <p className="mt-2 break-all font-mono text-3xl font-black text-zinc-900">{result}</p>
              </div>
              {error && (
                <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm font-bold text-rose-700">
                  {error}
                </p>
              )}
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2">
              {quickKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => appendKey(key)}
                  className={cn(
                    'rounded-2xl border border-white/55 bg-white/35 px-3 py-3 text-sm font-black text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl transition hover:bg-white/55',
                    ['+', '-', '*', '/', '^'].includes(key) && 'text-emerald-700',
                  )}
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => calculate()}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
              >
                <FunctionSquare size={18} />
                Calculate
              </button>
              <button
                type="button"
                onClick={() => {
                  setExpression('');
                  setResult('0');
                  setError(null);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/60 bg-white/35 px-5 py-3 text-sm font-black text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl transition hover:bg-white/55"
              >
                <RotateCcw size={18} />
                Clear
              </button>
            </div>

            <div className="mt-6">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Examples</p>
              <div className="flex flex-wrap gap-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => calculate(example)}
                    className="rounded-full border border-white/60 bg-white/35 px-4 py-2 text-xs font-bold text-zinc-600 backdrop-blur-xl transition hover:bg-white/55"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/55 bg-white/30 text-emerald-600 backdrop-blur-xl">
                  <Divide size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-zinc-900">Graph with Desmos</h2>
                  <p className="text-sm font-medium text-zinc-500">Use the embedded Desmos graphing calculator below.</p>
                </div>
              </div>
              <a
                href="https://www.desmos.com/calculator"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/35 px-4 py-3 text-sm font-black text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl transition hover:bg-white/55"
              >
                Open Desmos
                <ExternalLink size={16} />
              </a>
            </div>

            <div className="mb-4 rounded-3xl border border-white/55 bg-white/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl">
              <label htmlFor="graph-expression" className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                Graph idea
              </label>
              <input
                id="graph-expression"
                value={graphExpression}
                onChange={(event) => setGraphExpression(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-white/55 bg-white/40 px-4 py-3 font-mono text-sm font-bold text-zinc-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl focus:ring-2 focus:ring-emerald-500"
                placeholder="Example: y=x^2"
              />
              <p className="mt-2 text-xs font-medium text-zinc-500">
                Type this into Desmos: <span className="font-mono font-black text-zinc-800">{graphExpression || 'y=x^2'}</span>
              </p>
            </div>

            <div className="h-[520px] overflow-hidden rounded-3xl border border-white/60 bg-white/35 shadow-[0_16px_40px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-2xl">
              <iframe
                title="Desmos graphing calculator"
                src={desmosUrl}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </section>
        </div>

        {history.length > 0 && (
          <section className="rounded-[2rem] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
            <h2 className="text-xl font-black text-zinc-900">Recent calculations</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {history.map((item, index) => (
                <button
                  key={`${item.expression}-${index}`}
                  type="button"
                  onClick={() => {
                    setExpression(item.expression);
                    setResult(item.result);
                    setError(null);
                  }}
                  className="rounded-2xl border border-white/55 bg-white/30 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl transition hover:bg-white/45"
                >
                  <p className="truncate font-mono text-sm font-bold text-zinc-500">{item.expression}</p>
                  <p className="mt-1 truncate font-mono text-lg font-black text-zinc-900">{item.result}</p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
