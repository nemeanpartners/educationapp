import { useMemo, useState } from 'react';
import { BookOpen, Clipboard, KeyRound, Loader2, Sparkles, Target } from 'lucide-react';
import { geminiGenerateContent } from '../services/geminiProxy';

const classOptions = [
  'General',
  'Mathematics',
  'Science',
  'English',
  'History',
  'Geography',
  'Biology',
  'Chemistry',
  'Physics',
  'Economics',
  'Business',
  'Digital Technology',
];

const topicSuggestions: Record<string, string[]> = {
  General: ['Homework question', 'Exam preparation', 'Short response', 'Extended response'],
  Mathematics: ['Algebra', 'Functions', 'Trigonometry', 'Calculus', 'Statistics', 'Geometry'],
  Science: ['Scientific method', 'Forces', 'Energy', 'Cells', 'Ecosystems', 'Chemical reactions'],
  English: ['Essay analysis', 'Comprehension', 'Persuasive writing', 'Creative writing', 'Text response'],
  History: ['Source analysis', 'Cause and effect', 'Continuity and change', 'Significance', 'Essay planning'],
  Geography: ['Map skills', 'Sustainability', 'Human geography', 'Physical geography', 'Data analysis'],
  Biology: ['Cells', 'Genetics', 'Evolution', 'Homeostasis', 'Ecology'],
  Chemistry: ['Balancing equations', 'Stoichiometry', 'Acids and bases', 'Bonding', 'Periodic table'],
  Physics: ['Motion', 'Forces', 'Electricity', 'Waves', 'Energy transfer'],
  Economics: ['Supply and demand', 'Markets', 'Inflation', 'Opportunity cost', 'Government policy'],
  Business: ['Marketing', 'Operations', 'Finance', 'Human resources', 'Business strategy'],
  'Digital Technology': ['Algorithms', 'Programming', 'Data', 'Cybersecurity', 'Systems design'],
};

const sampleQuestion = `A ball is thrown upward from a height of 2 metres with an initial velocity of 18 m/s. Its height is modelled by h(t) = -4.9t^2 + 18t + 2. Determine the maximum height and explain what the answer means in context.`;

function buildPrompt(question: string, className: string, topic: string) {
  return `You are an expert school tutor. Break down the student's question so they know exactly what to do.

Class: ${className || 'General'}
Topic: ${topic || 'Not specified'}

Question:
${question}

Return plain text only using exactly these headings:
WHAT THE QUESTION IS ASKING
- Explain the task in student-friendly language.

KEY WORDS
- List important command words, numbers, variables, constraints, and context clues.

KEY FORMULAS OR KNOWLEDGE
- List formulas, facts, definitions, or methods needed. If there are no formulas, write the relevant knowledge instead.

3 STEP PLAN
1. First action the student should take.
2. Second action the student should take.
3. Third action the student should take.

FINAL CHECK
- Explain how the student can check if the answer is reasonable.

Rules:
- Be concise but useful.
- Do not solve the whole problem unless the breakdown requires a tiny setup.
- Use the selected class and topic to choose the most accurate method.
- Avoid markdown tables.`;
}

export default function QuestionBreakdownPage() {
  const [question, setQuestion] = useState('');
  const [selectedClass, setSelectedClass] = useState('General');
  const [topic, setTopic] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const topicOptions = useMemo(() => topicSuggestions[selectedClass] || topicSuggestions.General, [selectedClass]);

  const generateBreakdown = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError('Paste a question first.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setOutput('');

    try {
      const response = await geminiGenerateContent({
        model: 'gemini-3-flash-preview',
        contents: buildPrompt(trimmedQuestion, selectedClass, topic.trim()),
        config: {
          responseMimeType: 'text/plain',
        },
      });
      setOutput((response.text || '').trim() || 'No breakdown was returned. Try adding more question detail.');
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : '';
      if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
        setError('The AI is rate-limited right now. Wait a minute and try again.');
      } else if (message.includes('503') || message.includes('UNAVAILABLE')) {
        setError('The AI is busy right now. Try again shortly.');
      } else {
        setError(message || 'Could not generate a question breakdown.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative isolate -m-8 min-h-[calc(100vh-80px)] overflow-hidden bg-[#f4f5f7] p-6 sm:p-8 lg:p-12">
      <div className="pointer-events-none absolute left-[8%] top-20 h-56 w-56 rounded-full bg-rose-300/35 blur-3xl" />
      <div className="pointer-events-none absolute right-[12%] top-16 h-72 w-72 rounded-full bg-indigo-300/30 blur-[72px]" />
      <div className="pointer-events-none absolute bottom-16 left-[24%] h-48 w-72 rounded-full bg-amber-300/35 blur-[64px]" />
      <div className="pointer-events-none absolute bottom-24 right-[18%] h-52 w-52 rounded-full bg-emerald-300/25 blur-[70px]" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-8">
        <header className="rounded-[2rem] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/60 bg-white/35 text-rose-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
                <Target size={30} />
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight text-zinc-900">Question Breakdown</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-zinc-600">
                Paste a question and get what to do, key words, key formulas, and a clear 3-step plan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQuestion(sampleQuestion)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/35 px-5 py-3 text-sm font-black text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl transition hover:bg-white/55"
            >
              <Clipboard size={17} />
              Use sample
            </button>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <section className="rounded-[2rem] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/55 bg-white/30 text-rose-600 backdrop-blur-xl">
                <BookOpen size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-zinc-900">Question details</h2>
                <p className="text-sm font-medium text-zinc-500">Class and topic are optional, but they make the output sharper.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="class-select" className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                  Class
                </label>
                <select
                  id="class-select"
                  value={selectedClass}
                  onChange={(event) => {
                    setSelectedClass(event.target.value);
                    setTopic('');
                  }}
                  className="mt-3 w-full rounded-2xl border border-white/55 bg-white/45 px-4 py-3 text-sm font-bold text-zinc-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl focus:ring-2 focus:ring-rose-500"
                >
                  {classOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="topic-input" className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                  Topic
                </label>
                <input
                  id="topic-input"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  list="topic-suggestions"
                  placeholder="Optional topic"
                  className="mt-3 w-full rounded-2xl border border-white/55 bg-white/45 px-4 py-3 text-sm font-bold text-zinc-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl focus:ring-2 focus:ring-rose-500"
                />
                <datalist id="topic-suggestions">
                  {topicOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="question-text" className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                Paste question text
              </label>
              <textarea
                id="question-text"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Paste the full question here..."
                className="mt-3 min-h-72 w-full resize-none rounded-3xl border border-white/55 bg-white/45 px-4 py-4 text-sm font-semibold leading-7 text-zinc-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl placeholder:text-zinc-400 focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {error && (
              <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm font-bold text-rose-700">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={generateBreakdown}
              disabled={isGenerating || !question.trim()}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              Generate breakdown
            </button>
          </section>

          <section className="rounded-[2rem] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/55 bg-white/30 text-rose-600 backdrop-blur-xl">
                <KeyRound size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-zinc-900">Breakdown output</h2>
                <p className="text-sm font-medium text-zinc-500">Copy this into your notes or use it to plan your answer.</p>
              </div>
            </div>

            <div className="min-h-[560px] rounded-3xl border border-white/55 bg-white/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_10px_26px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              {isGenerating ? (
                <div className="flex h-full min-h-[500px] flex-col items-center justify-center gap-4 text-zinc-500">
                  <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
                  <p className="text-sm font-bold">Breaking down the question...</p>
                </div>
              ) : output ? (
                <pre className="whitespace-pre-wrap font-sans text-sm font-semibold leading-7 text-zinc-800">{output}</pre>
              ) : (
                <div className="flex h-full min-h-[500px] flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/60 bg-white/40 text-rose-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
                    <Target size={30} />
                  </div>
                  <p className="mt-4 text-lg font-black text-zinc-900">Your AI breakdown will appear here.</p>
                  <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-zinc-500">
                    Paste the question, choose a class, add a topic if useful, then generate.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
