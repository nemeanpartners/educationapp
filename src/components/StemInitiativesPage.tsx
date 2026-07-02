import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Atom,
  BadgeCheck,
  BookOpen,
  Brain,
  FlaskConical,
  HeartHandshake,
  Lightbulb,
  Orbit,
  Rocket,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { cn } from '../lib/utils';

type StreamId = 'stemher' | 'stemhim';

type Question = {
  id: string;
  prompt: string;
  options: Array<{
    label: string;
    stream: StreamId;
    explanation: string;
  }>;
};

const STREAM_COPY: Record<
  StreamId,
  {
    title: string;
    icon: typeof FlaskConical;
    accent: string;
    summary: string;
    pillars: string[];
    studentView: string[];
  }
> = {
  stemher: {
    title: 'STEMHER',
    icon: FlaskConical,
    accent: 'from-fuchsia-500/14 to-rose-500/10 border-fuchsia-100',
    summary: 'Support more girls into STEM through belonging, visible role models, and repeated confidence-building.',
    pillars: [
      'Make technical pathways feel socially reachable, not reserved for someone else.',
      'Use smaller practical wins so confidence grows before comparison shuts interest down.',
      'Show women in STEM early enough that students can picture themselves there.',
    ],
    studentView: [
      'Stories from women in science, engineering, medicine, and technology.',
      'Starter projects that make technical subjects feel approachable.',
      'Belonging cues so interest is not lost just because confidence is still forming.',
    ],
  },
  stemhim: {
    title: 'STEMHIM',
    icon: Brain,
    accent: 'from-sky-500/14 to-indigo-500/10 border-sky-100',
    summary: 'Support more boys in STEM through healthy challenge, structured goals, and identity built around capability.',
    pillars: [
      'Turn energy and competition into disciplined long-form effort.',
      'Keep motivation tied to contribution and future pathways, not only marks.',
      'Use hands-on challenge to convert curiosity into sustained technical interest.',
    ],
    studentView: [
      'Clear challenge ladders so difficulty feels purposeful instead of random.',
      'Project and build pathways that reward patience as well as ambition.',
      'Examples of where strong technical habits can lead beyond school.',
    ],
  },
};

const QUESTIONS: Question[] = [
  {
    id: 'identity',
    prompt: 'What would help you feel more sure that STEM could fit you?',
    options: [
      { label: 'Seeing people like me already in those fields', stream: 'stemher', explanation: 'Belonging often grows when the path looks socially and personally reachable.' },
      { label: 'Having a challenge I can work toward and measure', stream: 'stemhim', explanation: 'Motivation often strengthens when progress has structure and visible milestones.' },
    ],
  },
  {
    id: 'confidence',
    prompt: 'When a subject feels difficult, what keeps you in it longer?',
    options: [
      { label: 'Gentle entry points and low-pressure practice', stream: 'stemher', explanation: 'Confidence usually grows first through small successful repetitions.' },
      { label: 'A harder target that feels worth chasing', stream: 'stemhim', explanation: 'Some students stay engaged when the task feels demanding but meaningful.' },
    ],
  },
  {
    id: 'future',
    prompt: 'Which message is more likely to pull you back in?',
    options: [
      { label: 'You belong here, and there is space for you in STEM', stream: 'stemher', explanation: 'Belonging language reduces social friction and fear of not fitting the field.' },
      { label: 'You can build real capability here and use it in the future', stream: 'stemhim', explanation: 'Competence language helps students connect effort with identity and outcomes.' },
    ],
  },
  {
    id: 'support',
    prompt: 'Which support style would help most this term?',
    options: [
      { label: 'Mentors, role models, and visible encouragement', stream: 'stemher', explanation: 'Representation and encouragement are often what stop early dropout from the pathway.' },
      { label: 'Clear goals, challenge blocks, and project-based proof', stream: 'stemhim', explanation: 'Structured challenge can convert interest into consistency.' },
    ],
  },
  {
    id: 'engagement',
    prompt: 'What would make a STEM initiative feel useful instead of performative?',
    options: [
      { label: 'Something that makes me feel seen and less alone in the subject', stream: 'stemher', explanation: 'Feeling seen lowers withdrawal and makes persistence more likely.' },
      { label: 'Something that gives me a reason to push harder with direction', stream: 'stemhim', explanation: 'Direction reduces wasted effort and makes hard work feel intentional.' },
    ],
  },
];

const LEARN_CARDS = [
  {
    title: 'Why belonging matters',
    text: 'Students do not stay in difficult pathways on ability alone. They stay when the field feels like somewhere they are allowed to grow.',
    icon: HeartHandshake,
  },
  {
    title: 'Why challenge matters',
    text: 'Motivation lasts longer when work feels purposeful, measurable, and connected to a real future identity.',
    icon: Rocket,
  },
  {
    title: 'Why both streams work',
    text: 'Different students disengage for different reasons. A stronger initiative solves for belonging and disciplined challenge at the same time.',
    icon: Orbit,
  },
];

const STUDENT_OUTCOMES = [
  'More students can picture themselves in STEM early.',
  'More students keep going once subjects become harder.',
  'More students see a clear pathway from school effort to future opportunities.',
];

export default function StemInitiativesPage() {
  const [answers, setAnswers] = useState<Record<string, StreamId>>({});
  const [activeStream, setActiveStream] = useState<StreamId>('stemher');

  const score = useMemo(() => {
    return QUESTIONS.reduce(
      (acc, question) => {
        const answer = answers[question.id];
        if (answer) acc[answer] += 1;
        return acc;
      },
      { stemher: 0, stemhim: 0 },
    );
  }, [answers]);

  const completedCount = Object.keys(answers).length;
  const recommendedStream: StreamId = score.stemhim > score.stemher ? 'stemhim' : 'stemher';
  const recommendedCopy = STREAM_COPY[recommendedStream];

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-8 p-6">
      <section className="rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-8 shadow-[0_24px_70px_rgba(76,29,149,0.08)]">
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr] xl:items-start">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-4 py-2 text-sm font-bold text-violet-800">
              <Sparkles size={15} />
              STEM initiatives
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-zinc-900 md:text-5xl">STEMHER and STEMHIM</h1>
            <p className="mt-4 max-w-4xl text-base font-medium leading-8 text-zinc-600">
              This is the student-facing side of the initiative. It should help a student understand why the program exists, how it supports them, and what kind of encouragement or challenge would keep them engaged in STEM.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              { label: 'Questions', value: '5', icon: BookOpen },
              { label: 'Streams', value: '2', icon: Atom },
              { label: 'Outcome', value: 'Belonging + drive', icon: Star },
            ].map((item) => (
              <div key={item.label} className="rounded-[26px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-black text-zinc-900">{item.value}</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{item.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Student side</p>
                <h2 className="mt-2 text-2xl font-black text-zinc-900">A 5-question STEM fit check</h2>
                <p className="mt-2 text-sm font-medium leading-7 text-zinc-600">
                  Answer these to see which support style would probably keep you more engaged right now.
                </p>
              </div>
              <div className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">
                {completedCount}/5 done
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {QUESTIONS.map((question, index) => (
                <div key={question.id} className="rounded-[28px] border border-zinc-100 bg-zinc-50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-black text-zinc-700 shadow-sm">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-black text-zinc-900">{question.prompt}</h3>
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {question.options.map((option) => {
                          const selected = answers[question.id] === option.stream;
                          return (
                            <button
                              key={option.label}
                              type="button"
                              onClick={() => {
                                setAnswers((current) => ({ ...current, [question.id]: option.stream }));
                                setActiveStream(option.stream);
                              }}
                              className={cn(
                                'rounded-3xl border px-4 py-4 text-left transition',
                                selected
                                  ? 'border-violet-300 bg-violet-50 shadow-[0_10px_24px_rgba(139,92,246,0.10)]'
                                  : 'border-zinc-200 bg-white hover:border-zinc-300'
                              )}
                            >
                              <p className="text-sm font-black text-zinc-900">{option.label}</p>
                              <p className="mt-2 text-xs font-medium leading-6 text-zinc-500">{option.explanation}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">What students can learn here</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {LEARN_CARDS.map((card) => (
                <div key={card.title} className="rounded-3xl border border-white/80 bg-white/80 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-zinc-900">{card.title}</h3>
                  <p className="mt-2 text-sm font-medium leading-7 text-zinc-600">{card.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-3">
              {(['stemher', 'stemhim'] as StreamId[]).map((streamId) => {
                const stream = STREAM_COPY[streamId];
                const Icon = stream.icon;
                const active = activeStream === streamId;

                return (
                  <button
                    key={streamId}
                    type="button"
                    onClick={() => setActiveStream(streamId)}
                    className={cn(
                      'rounded-3xl border px-5 py-4 text-left transition',
                      active ? 'border-zinc-900 bg-zinc-900 text-white shadow-[0_18px_36px_rgba(15,23,42,0.18)]' : 'border-zinc-200 bg-zinc-50 text-zinc-700'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={18} />
                      <span className="text-sm font-black">{stream.title}</span>
                    </div>
                    <p className={cn('mt-2 max-w-sm text-xs font-semibold leading-5', active ? 'text-white/75' : 'text-zinc-500')}>
                      {stream.summary}
                    </p>
                  </button>
                );
              })}
            </div>

            <motion.div
              key={activeStream}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('mt-6 rounded-[2rem] border bg-gradient-to-br p-6', STREAM_COPY[activeStream].accent)}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Recommended support stream</p>
                  <h2 className="mt-2 text-3xl font-black text-zinc-900">{recommendedCopy.title}</h2>
                  <p className="mt-3 text-sm font-medium leading-7 text-zinc-600">{recommendedCopy.summary}</p>
                </div>
                <div className="rounded-full bg-white/90 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-700">
                  Student fit
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {recommendedCopy.studentView.map((item) => (
                  <div key={item} className="rounded-3xl border border-white/80 bg-white/80 px-4 py-4">
                    <p className="text-sm font-bold leading-6 text-zinc-700">{item}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <BadgeCheck size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">Why this helps</p>
                <h2 className="text-2xl font-black text-zinc-900">This is what the initiative should do for the student</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {STUDENT_OUTCOMES.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/80 px-4 py-4">
                  <Users className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-bold leading-6 text-zinc-700">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">
              Student-facing initiative layer
              <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
