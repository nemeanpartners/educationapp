import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clipboard,
  FileImage,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
  Upload,
} from 'lucide-react';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from '@/lib/portal-firestore';
import { db } from '../firebase';
import type { UserProfile } from '../types';
import { geminiService } from '../services/gemini';
import type { FormulaExplanation } from '../services/gemini';
import { cn } from '../lib/utils';

type SavedFormulaExplanation = {
  id: string;
  userId: string;
  title: string;
  formula: string;
  subject: string;
  topic: string;
  explanation: FormulaExplanation;
  createdAt?: unknown;
};

const subjectOptions = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Economics',
  'Business',
  'Engineering',
  'General science',
];

const topicSuggestions: Record<string, string[]> = {
  Mathematics: ['Algebra', 'Geometry', 'Trigonometry', 'Calculus', 'Statistics', 'Probability'],
  Physics: ['Motion', 'Forces', 'Energy', 'Electricity', 'Waves', 'Fields'],
  Chemistry: ['Stoichiometry', 'Solutions', 'Equilibrium', 'Acids and bases', 'Thermochemistry'],
  Biology: ['Genetics', 'Ecology', 'Cells', 'Photosynthesis', 'Population models'],
  Economics: ['Demand and supply', 'Elasticity', 'Revenue', 'Growth', 'Interest'],
  Business: ['Finance', 'Break-even', 'Profit', 'Accounting ratios', 'Forecasting'],
  Engineering: ['Mechanics', 'Circuits', 'Materials', 'Fluids', 'Control systems'],
  'General science': ['Measurement', 'Rates', 'Units', 'Graphs', 'Data analysis'],
};

const sampleFormula = 'v = u + at';

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the image file.'));
    reader.readAsDataURL(file);
  });
}

export default function FormulaExplainerPage({ profile }: { profile: UserProfile | null }) {
  const [formula, setFormula] = useState(sampleFormula);
  const [subject, setSubject] = useState('Physics');
  const [topic, setTopic] = useState('Motion');
  const [explanation, setExplanation] = useState<FormulaExplanation | null>(null);
  const [savedItems, setSavedItems] = useState<SavedFormulaExplanation[]>([]);
  const [imagePreview, setImagePreview] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const topicOptions = useMemo(() => topicSuggestions[subject] || [], [subject]);

  useEffect(() => {
    if (!profile?.uid) {
      setSavedItems([]);
      return;
    }

    const q = query(
      collection(db, 'formulaExplanations'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      setSavedItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as SavedFormulaExplanation)));
    });
  }, [profile?.uid]);

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setError(null);
    setSavedMessage('');

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImagePreview(dataUrl);
      const extracted = await geminiService.formulaImageToText(dataUrl);
      if (!extracted) {
        setError('I could not find a formula in that image. Try a clearer crop or paste the formula manually.');
        return;
      }
      setFormula(extracted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not extract text from the image.');
    } finally {
      setIsExtracting(false);
      event.target.value = '';
    }
  };

  const analyseFormula = async () => {
    const trimmedFormula = formula.trim();
    if (!trimmedFormula) {
      setError('Paste a formula or upload an image first.');
      return;
    }

    setIsAnalysing(true);
    setError(null);
    setSavedMessage('');

    try {
      const result = await geminiService.explainFormula(trimmedFormula, subject, topic.trim());
      if (!result.whatItIs || !Array.isArray(result.howToUseIt)) {
        throw new Error('The AI returned an incomplete explanation. Try adding the subject and topic.');
      }
      setExplanation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not explain that formula.');
    } finally {
      setIsAnalysing(false);
    }
  };

  const saveExplanation = async () => {
    if (!profile?.uid || !explanation) {
      setError('Sign in and generate an explanation before saving.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSavedMessage('');

    try {
      await addDoc(collection(db, 'formulaExplanations'), {
        userId: profile.uid,
        title: explanation.title || explanation.normalizedFormula || formula,
        formula,
        subject,
        topic,
        explanation,
        createdAt: serverTimestamp(),
      });
      setSavedMessage('Explanation saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this explanation.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative isolate -m-8 min-h-[calc(100vh-80px)] overflow-hidden bg-[#f7f8fb] p-4 sm:p-6 lg:p-10">
      <div className="pointer-events-none absolute left-[6%] top-12 h-64 w-64 rounded-full bg-teal-300/35 blur-3xl" />
      <div className="pointer-events-none absolute right-[10%] top-28 h-72 w-72 rounded-full bg-amber-300/25 blur-[76px]" />
      <div className="pointer-events-none absolute bottom-14 left-[26%] h-56 w-80 rounded-full bg-sky-300/25 blur-[72px]" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/45 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/50 text-teal-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <BookOpen size={30} />
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950">Formula Explainer</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
                Paste a formula or upload an image, then get the meaning, variables, question clues, and a clear method for using it.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormula(sampleFormula);
                setSubject('Physics');
                setTopic('Motion');
                setExplanation(null);
                setImagePreview('');
                setSavedMessage('');
                setError(null);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/45 px-5 py-3 text-sm font-black text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:bg-white/70"
            >
              <RotateCcw size={17} />
              Reset
            </button>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-white/70 bg-white/45 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/50 text-teal-600">
                <Clipboard size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">Formula details</h2>
                <p className="text-sm font-medium text-slate-500">Subject and topic make the explanation more accurate.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="formula-subject" className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Subject</label>
                <select
                  id="formula-subject"
                  value={subject}
                  onChange={(event) => {
                    setSubject(event.target.value);
                    setTopic(topicSuggestions[event.target.value]?.[0] || '');
                  }}
                  className="mt-2 w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {subjectOptions.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="formula-topic" className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Topic</label>
                <input
                  id="formula-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  list="formula-topic-options"
                  className="mt-2 w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Example: Motion"
                />
                <datalist id="formula-topic-options">
                  {topicOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="formula-input" className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Formula</label>
              <textarea
                id="formula-input"
                value={formula}
                onChange={(event) => setFormula(event.target.value)}
                className="mt-2 min-h-36 w-full resize-none rounded-3xl border border-white/70 bg-white/60 px-5 py-4 font-mono text-base font-bold leading-7 text-slate-950 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_28px_rgba(15,23,42,0.05)] focus:ring-2 focus:ring-teal-500"
                placeholder="Paste a formula, for example: F = ma"
              />
            </div>

            <div className="mt-5 rounded-3xl border border-dashed border-teal-200 bg-white/45 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                    <FileImage size={22} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-950">Upload formula image</h3>
                    <p className="text-sm font-medium text-slate-500">Use a clear crop for best extraction.</p>
                  </div>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800">
                  {isExtracting ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                  {isExtracting ? 'Extracting' : 'Choose image'}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="sr-only" disabled={isExtracting} />
                </label>
              </div>
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Uploaded formula preview"
                  className="mt-4 max-h-56 w-full rounded-2xl border border-white/70 object-contain bg-white/70"
                />
              )}
            </div>

            {error && (
              <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm font-bold text-rose-700">
                {error}
              </p>
            )}
            {savedMessage && (
              <p className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-black text-emerald-700">
                <CheckCircle2 size={17} />
                {savedMessage}
              </p>
            )}

            <button
              type="button"
              onClick={analyseFormula}
              disabled={isAnalysing || isExtracting || !formula.trim()}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-teal-200 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalysing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
              Analyse formula
            </button>

            {savedItems.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Saved explanations</p>
                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {savedItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setFormula(item.formula);
                        setSubject(item.subject);
                        setTopic(item.topic);
                        setExplanation(item.explanation);
                        setSavedMessage('');
                        setError(null);
                      }}
                      className="w-full rounded-2xl border border-white/70 bg-white/55 px-4 py-3 text-left transition hover:bg-white"
                    >
                      <p className="truncate text-sm font-black text-slate-900">{item.title}</p>
                      <p className="truncate font-mono text-xs font-bold text-slate-500">{item.formula}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/45 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl sm:p-6">
            {!explanation ? (
              <div className="flex min-h-[620px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/45 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-teal-50 text-teal-600">
                  <BookOpen size={34} />
                </div>
                <h2 className="mt-5 text-2xl font-black text-slate-950">Formula explanation appears here</h2>
                <p className="mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">
                  The output is organised into what it is, why it matters, and how to use it in questions.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-3xl border border-white/70 bg-white/60 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{explanation.subject} / {explanation.topic}</p>
                      <h2 className="mt-2 text-3xl font-black text-slate-950">{explanation.title}</h2>
                      <p className="mt-3 rounded-2xl bg-slate-950 px-4 py-3 font-mono text-xl font-black text-white">
                        {explanation.normalizedFormula}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={saveExplanation}
                      disabled={isSaving || !profile?.uid}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-100 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      Save
                    </button>
                  </div>
                </div>

                <ExplanationBlock number="1" title="What it is">
                  <p className="text-sm font-medium leading-7 text-slate-700">{explanation.whatItIs}</p>
                  {explanation.variables.length > 0 && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {explanation.variables.map((variable, index) => (
                        <div key={`${variable.symbol}-${index}`} className="rounded-2xl border border-white/70 bg-white/60 p-4">
                          <p className="font-mono text-lg font-black text-slate-950">{variable.symbol}</p>
                          <p className="mt-1 text-sm font-bold text-slate-700">{variable.meaning}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">Units: {variable.units || 'depends on the question'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ExplanationBlock>

                <ExplanationBlock number="2" title="Why it is used">
                  <p className="text-sm font-medium leading-7 text-slate-700">{explanation.whyItIsUsed}</p>
                  <List title="Look for these clues" items={explanation.questionClues} />
                </ExplanationBlock>

                <ExplanationBlock number="3" title="How to use it">
                  <ol className="space-y-3">
                    {explanation.howToUseIt.map((step, index) => (
                      <li key={`${step}-${index}`} className="flex gap-3 rounded-2xl bg-white/60 p-4 text-sm font-semibold leading-6 text-slate-700">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
                          {index + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4 rounded-2xl bg-teal-50/80 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Worked example</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-7 text-slate-700">{explanation.workedExample}</p>
                  </div>
                  <List title="Common mistakes" items={explanation.commonMistakes} tone="rose" />
                </ExplanationBlock>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ExplanationBlock({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/55 p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-600 text-sm font-black text-white">
          {number}
        </span>
        <h3 className="text-xl font-black text-slate-950">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function List({ title, items, tone = 'teal' }: { title: string; items: string[]; tone?: 'teal' | 'rose' }) {
  if (!items.length) return null;

  return (
    <div className="mt-4">
      <p className={cn('mb-3 text-xs font-black uppercase tracking-[0.18em]', tone === 'rose' ? 'text-rose-600' : 'text-teal-700')}>
        {title}
      </p>
      <div className="space-y-2">
        {items.map((item, index) => (
          <p key={`${item}-${index}`} className="rounded-2xl bg-white/60 px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
