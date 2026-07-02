import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileUp,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { geminiService } from '../services/gemini';
import type { PracticeQuizQuestion } from '../services/gemini';
import { getSavedPracticeQuiz, savePracticeQuiz } from '../lib/practice-quiz-storage';

const subjects = [
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the uploaded file.'));
    reader.readAsDataURL(file);
  });
}

function normaliseQuestions(questions: PracticeQuizQuestion[]) {
  return questions
    .filter((question) => question.question && question.options?.length >= 2 && question.correctAnswer)
    .slice(0, 10)
    .map((question) => {
      const options = question.options.slice(0, 4);
      return {
        ...question,
        options,
        correctAnswer: options.includes(question.correctAnswer) ? question.correctAnswer : options[0],
        explanation: question.explanation || 'Review the source material for why this answer is correct.',
      };
    });
}

export default function PracticeQuizPage() {
  const [searchParams] = useSearchParams();
  const savedQuizId = searchParams.get('savedQuiz');
  const [subject, setSubject] = useState('Science');
  const [topic, setTopic] = useState(searchParams.get('topic') || 'Volcanoes');
  const [instructions, setInstructions] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [fileDataUrl, setFileDataUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [questions, setQuestions] = useState<PracticeQuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const savedQuiz = getSavedPracticeQuiz(savedQuizId);
    if (!savedQuiz) return;
    setSubject(savedQuiz.subject || 'General');
    setTopic(savedQuiz.topic || savedQuiz.title);
    setInstructions(savedQuiz.instructions || '');
    setSourceText(savedQuiz.sourceText || '');
    setQuestions(normaliseQuestions(savedQuiz.questions));
    setAnswers({});
    setCurrentIndex(0);
    setIsSubmitted(false);
    setError(null);
    setSaveMessage('Loaded saved quiz.');
  }, [savedQuizId]);

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const score = useMemo(
    () => questions.reduce((total, question, index) => total + (answers[index] === question.correctAnswer ? 1 : 0), 0),
    [answers, questions],
  );

  const saveQuizAttempt = () => {
    const attempt = {
      id: `practice-${Date.now()}`,
      source: 'Practice Quiz',
      title: topic || subject,
      subject,
      score,
      total: questions.length,
      createdAt: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(window.localStorage.getItem('learning-quiz-attempts') || '[]');
      window.localStorage.setItem('learning-quiz-attempts', JSON.stringify([attempt, ...existing].slice(0, 50)));
    } catch (error) {
      console.error('Could not save quiz attempt:', error);
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      setFileName(file.name);
      setFileDataUrl(await readFileAsDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the uploaded file.');
      setFileName('');
      setFileDataUrl('');
    } finally {
      event.target.value = '';
    }
  };

  const generateQuiz = async () => {
    if (!topic.trim() && !sourceText.trim() && !fileDataUrl) {
      setError('Enter a topic, paste notes, or upload a PDF/image first.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setIsSubmitted(false);
    setAnswers({});
    setCurrentIndex(0);

    try {
      const result = await geminiService.generatePracticeQuiz({
        subject,
        topic: topic.trim() || fileName || 'Uploaded study material',
        instructions: instructions.trim(),
        sourceText: sourceText.trim(),
        fileDataUrl,
      });
      const cleanQuestions = normaliseQuestions(result);
      if (cleanQuestions.length !== 10) {
        throw new Error('The quiz generator returned fewer than 10 usable questions. Try adding more topic detail.');
      }
      setQuestions(cleanQuestions);
      setSaveMessage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the quiz.');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetQuiz = () => {
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setIsSubmitted(false);
    setError(null);
    setSaveMessage(null);
  };

  const saveCurrentQuiz = () => {
    if (!questions.length) return;
    savePracticeQuiz({
      title: topic || subject,
      topic: topic || subject,
      subject,
      instructions,
      sourceText,
      questions,
    });
    setSaveMessage('Quiz saved with topic, context, and questions.');
  };

  return (
    <div className="relative isolate -m-8 min-h-[calc(100vh-80px)] overflow-hidden bg-[#f7f8fb] p-4 sm:p-6 lg:p-10">
      <div className="pointer-events-none absolute left-[7%] top-14 h-64 w-64 rounded-full bg-emerald-300/35 blur-3xl" />
      <div className="pointer-events-none absolute right-[12%] top-24 h-80 w-80 rounded-full bg-sky-300/25 blur-[80px]" />
      <div className="pointer-events-none absolute bottom-14 left-[24%] h-56 w-80 rounded-full bg-amber-300/25 blur-[70px]" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/45 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/50 text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <CheckCircle2 size={30} />
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950">Practice Quiz</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
                Generate 10 AI questions from a topic, subject, pasted notes, or an uploaded PDF/image, then answer and mark them online.
              </p>
            </div>
            <button
              type="button"
              onClick={resetQuiz}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/45 px-5 py-3 text-sm font-black text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:bg-white/70"
            >
              <RotateCcw size={17} />
              New quiz
            </button>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-white/70 bg-white/45 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/50 text-emerald-600">
                <ClipboardList size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">Build your quiz</h2>
                <p className="text-sm font-medium text-slate-500">Use enough context for accurate questions.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="practice-subject" className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Subject</label>
                <select
                  id="practice-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {subjects.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="practice-topic" className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Topic</label>
                <input
                  id="practice-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Example: Volcanoes"
                />
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="practice-notes" className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Paste notes or source text</label>
              <textarea
                id="practice-notes"
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                className="mt-2 min-h-36 w-full resize-none rounded-3xl border border-white/70 bg-white/60 px-5 py-4 text-sm font-semibold leading-7 text-slate-950 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_28px_rgba(15,23,42,0.05)] focus:ring-2 focus:ring-emerald-500"
                placeholder="Optional: paste class notes, a study guide, or key facts here."
              />
            </div>

            <div className="mt-5">
              <label htmlFor="practice-instructions" className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Question focus</label>
              <input
                id="practice-instructions"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Optional: make it exam style, definitions only, harder questions..."
              />
            </div>

            <div className="mt-5 rounded-3xl border border-dashed border-emerald-200 bg-white/45 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <FileUp size={22} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-950">Upload source</h3>
                    <p className="text-sm font-medium text-slate-500">{fileName || 'Optional PDF, image, or text file.'}</p>
                  </div>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800">
                  <FileUp size={18} />
                  Choose file
                  <input type="file" accept=".pdf,image/*,.txt,text/plain" onChange={handleFile} className="sr-only" />
                </label>
              </div>
              {fileName && (
                <button
                  type="button"
                  onClick={() => {
                    setFileDataUrl('');
                    setFileName('');
                  }}
                  className="mt-3 text-xs font-black text-slate-500 underline decoration-slate-300 underline-offset-4"
                >
                  Remove upload
                </button>
              )}
            </div>

            {error && (
              <p className="mt-5 flex gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm font-bold text-rose-700">
                <AlertCircle size={18} className="shrink-0" />
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={generateQuiz}
              disabled={isGenerating}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
              Generate 10 questions
            </button>
            {questions.length > 0 && (
              <button
                type="button"
                onClick={saveCurrentQuiz}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-5 py-4 text-sm font-black text-slate-800 transition hover:bg-white"
              >
                Save This Quiz
              </button>
            )}
            {saveMessage && (
              <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-bold text-emerald-700">
                {saveMessage}
              </p>
            )}
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/45 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl sm:p-6">
            {!currentQuestion ? (
              <div className="flex min-h-[620px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/45 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={34} />
                </div>
                <h2 className="mt-5 text-2xl font-black text-slate-950">Your quiz appears here</h2>
                <p className="mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">
                  Generate a set, select answers, then submit to see your score and a full review.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-3xl border border-white/70 bg-white/60 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Question {currentIndex + 1} of {questions.length}
                      </p>
                      <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">{topic || subject}</h2>
                    </div>
                    <div className="rounded-full bg-white/80 px-4 py-2 text-sm font-black text-slate-600">
                      {answeredCount}/{questions.length} answered
                    </div>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
                  </div>
                </div>

                <div className="rounded-3xl border border-white/70 bg-white/60 p-6">
                  <h3 className="text-xl font-black leading-8 text-slate-950">{currentQuestion.question}</h3>
                  <div className="mt-5 space-y-3">
                    {currentQuestion.options.map((option) => {
                      const selected = answers[currentIndex] === option;
                      const correct = isSubmitted && option === currentQuestion.correctAnswer;
                      const wrong = isSubmitted && selected && option !== currentQuestion.correctAnswer;

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            if (!isSubmitted) setAnswers((current) => ({ ...current, [currentIndex]: option }));
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left text-sm font-bold leading-6 transition',
                            selected && !isSubmitted && 'border-emerald-300 bg-emerald-50 text-emerald-900',
                            !selected && !isSubmitted && 'border-white/70 bg-white/70 text-slate-700 hover:bg-white',
                            correct && 'border-emerald-300 bg-emerald-50 text-emerald-900',
                            wrong && 'border-rose-300 bg-rose-50 text-rose-900',
                            isSubmitted && !correct && !wrong && 'border-white/70 bg-white/60 text-slate-600',
                          )}
                        >
                          <span>{option}</span>
                          {correct && <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />}
                          {wrong && <XCircle size={18} className="shrink-0 text-rose-600" />}
                        </button>
                      );
                    })}
                  </div>
                  {isSubmitted && (
                    <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Explanation</p>
                      <p className="mt-2 text-sm font-medium leading-6">{currentQuestion.explanation}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((current) => Math.max(0, current - 1))}
                    disabled={currentIndex === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/60 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-white disabled:opacity-40"
                  >
                    <ChevronLeft size={18} />
                    Previous
                  </button>
                  <div className="flex gap-3">
                    {!isSubmitted && (
                      <button
                        type="button"
                        onClick={() => {
                          saveQuizAttempt();
                          setIsSubmitted(true);
                        }}
                        disabled={answeredCount < questions.length}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Mark quiz
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((current) => Math.min(questions.length - 1, current + 1))}
                      disabled={currentIndex === questions.length - 1}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/60 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-white disabled:opacity-40"
                    >
                      Next
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>

                {isSubmitted && (
                  <div className="rounded-3xl border border-white/70 bg-white/60 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Result</p>
                        <h3 className="mt-1 text-3xl font-black text-slate-950">{score}/{questions.length}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAnswers({});
                          setCurrentIndex(0);
                          setIsSubmitted(false);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
                      >
                        <RotateCcw size={17} />
                        Try again
                      </button>
                    </div>
                    <div className="mt-5 space-y-3">
                      {questions.map((question, index) => {
                        const correct = answers[index] === question.correctAnswer;
                        return (
                          <button
                            key={`${question.question}-${index}`}
                            type="button"
                            onClick={() => setCurrentIndex(index)}
                            className="flex w-full gap-3 rounded-2xl bg-white/70 p-4 text-left transition hover:bg-white"
                          >
                            {correct ? (
                              <CheckCircle2 size={20} className="mt-1 shrink-0 text-emerald-600" />
                            ) : (
                              <XCircle size={20} className="mt-1 shrink-0 text-rose-600" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-950">{index + 1}. {question.question}</p>
                              <p className="mt-1 text-xs font-bold text-slate-500">Your answer: {answers[index] || 'No answer'}</p>
                              {!correct && <p className="mt-1 text-xs font-bold text-emerald-700">Correct answer: {question.correctAnswer}</p>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
