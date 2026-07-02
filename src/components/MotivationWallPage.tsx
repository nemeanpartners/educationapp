import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Heart,
  Lightbulb,
  Quote,
  Sparkles,
  Star,
  Sunrise,
  WandSparkles,
} from 'lucide-react';

const biographies = [
  {
    name: 'Marie Curie',
    role: 'Scientist',
    lesson: 'Progress can be quiet and repetitive. Deep work often looks ordinary while it is happening.',
    story:
      'Marie Curie spent years doing slow, careful lab work before the world noticed the impact. Her example is useful when school feels repetitive: important results often come from steady blocks of effort rather than dramatic bursts.',
  },
  {
    name: 'Nelson Mandela',
    role: 'Leader',
    lesson: 'Long goals need emotional endurance, not perfect days.',
    story:
      'Mandela’s life shows that progress is rarely linear. The value here for students is simple: one hard day does not cancel the future. You keep moving by recommitting to the next meaningful action.',
  },
  {
    name: 'Ada Lovelace',
    role: 'Mathematician',
    lesson: 'Curiosity grows when you connect detail to possibility.',
    story:
      'Ada Lovelace stayed engaged because she looked past isolated facts and asked what they could become. When a subject feels dry, reconnecting it to what it enables can restore motivation.',
  },
];

const soothingFacts = [
  'Your brain strengthens recall more effectively when learning is spaced across shorter sessions rather than forced into one exhausted block.',
  'Feeling stuck is often a sign of cognitive load, not low ability. A reset can improve performance faster than pushing harder in panic.',
  'Retrieval practice feels harder than rereading because it is working. That friction is often a sign that learning is actually happening.',
  'Momentum usually returns after one finished task. Motivation often follows action instead of arriving before it.',
];

const futureScenes = [
  {
    title: 'A calmer exam week',
    text: 'Prepared students still feel nerves, but the work feels familiar. Revision becomes recall instead of panic because the brain has seen the material in smaller pieces before.',
  },
  {
    title: 'More choices later',
    text: 'Consistent study does not just improve marks. It keeps pathways open. Better habits now create more flexibility in subjects, courses, and future work.',
  },
  {
    title: 'Less self-doubt',
    text: 'When you keep evidence of effort, your confidence stops depending on mood alone. You can point to completed blocks, finished tasks, and recovered focus.',
  },
];

const resetSteps = [
  'Name the state: “I am overloaded right now.” This lowers panic and makes the problem concrete.',
  'Reduce the target: choose one 10-minute restart task instead of trying to fix the whole day.',
  'Use external support: timer, checklist, ambient sound, and one visible next step.',
  'Finish with evidence: tick something off so your brain gets proof that progress happened.',
];

const encouragements = [
  'You do not need to feel fully ready to restart.',
  'Small finished tasks rebuild trust faster than big intentions.',
  'Study pressure shrinks when the next action is visible.',
];

type ViewMode = 'biographies' | 'facts' | 'future';

export default function MotivationWallPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('biographies');
  const [bioIndex, setBioIndex] = useState(0);
  const [factIndex, setFactIndex] = useState(0);
  const [futureIndex, setFutureIndex] = useState(0);

  const activeBiography = biographies[bioIndex];
  const activeFact = soothingFacts[factIndex];
  const activeFuture = futureScenes[futureIndex];

  const modeCards = useMemo(
    () => [
      { id: 'biographies' as const, label: 'Life stories', icon: BookOpen, description: 'Read grounded biographies when effort feels flat.' },
      { id: 'facts' as const, label: 'Cool facts', icon: Lightbulb, description: 'Use short brain-based reminders to lower overwhelm.' },
      { id: 'future' as const, label: 'Why it matters', icon: Sunrise, description: 'Reconnect study with the future it protects.' },
    ],
    []
  );

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-8 p-6">
      <section className="rounded-[2rem] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-8 shadow-[0_24px_70px_rgba(14,165,233,0.08)]">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center xl:grid-cols-[minmax(0,1fr)_480px]">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-sm font-bold text-sky-800">
              <Sparkles size={15} />
              Motivation Wall
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-zinc-900 md:text-5xl">A softer page for when study pressure spikes</h1>
            <p className="mt-4 text-base font-medium leading-7 text-zinc-600">
              This space is designed to reduce overwhelm, not add more noise. Use it to reset, read something grounding, and return to your study plan with a smaller, clearer next step.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { labelTop: 'Reset', labelBottom: 'steps', value: resetSteps.length, icon: Brain },
              { labelTop: 'Story', labelBottom: 'prompts', value: biographies.length, icon: Quote },
              { labelTop: 'Encourage', labelBottom: 'ments', value: encouragements.length, icon: Heart },
            ].map((item) => (
              <div
                key={`${item.labelTop}-${item.labelBottom}`}
                className="flex min-h-[232px] min-w-0 flex-col items-center justify-center rounded-[2rem] border border-white/85 bg-white/82 px-4 py-7 text-center shadow-[0_16px_35px_rgba(14,165,233,0.08)]"
              >
                <item.icon className="mx-auto h-6 w-6 text-sky-600" />
                <div className="mt-3 text-4xl font-black leading-none text-zinc-900">{item.value}</div>
                <div className="mt-4 text-sm font-black uppercase leading-5 tracking-[0.14em] text-zinc-500">
                  <div>{item.labelTop}</div>
                  <div>{item.labelBottom}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <WandSparkles size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">First, regulate</p>
              <h2 className="text-2xl font-black text-zinc-900">What to do when you want to give up</h2>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {resetSteps.map((step, index) => (
              <div key={step} className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm font-bold leading-6 text-zinc-700">{step}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-3xl border border-sky-100 bg-sky-50/70 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">Psychology note</p>
            <p className="mt-3 text-sm font-bold leading-7 text-zinc-700">
              Overwhelm narrows attention and makes everything feel equally urgent. Recovery works better when the next step is concrete, visible, and small enough to finish.
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-3">
            {modeCards.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`rounded-full px-4 py-3 text-left transition ${
                  viewMode === mode.id
                    ? 'bg-zinc-900 text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)]'
                    : 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <mode.icon size={15} />
                  <span className="text-sm font-black">{mode.label}</span>
                </div>
                <p className={`mt-2 max-w-xs text-xs font-semibold leading-5 ${viewMode === mode.id ? 'text-white/75' : 'text-zinc-500'}`}>
                  {mode.description}
                </p>
              </button>
            ))}
          </div>

          {viewMode === 'biographies' && (
            <motion.div
              key={activeBiography.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-500">Biography</p>
                  <h3 className="mt-2 text-3xl font-black text-zinc-900">{activeBiography.name}</h3>
                  <p className="mt-1 text-sm font-bold text-violet-700">{activeBiography.role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBioIndex((current) => (current + 1) % biographies.length)}
                  className="rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-black text-violet-700 transition hover:bg-violet-50"
                >
                  Next story
                </button>
              </div>
              <div className="mt-6 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-3xl border border-white/80 bg-white/80 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Why this helps</p>
                  <p className="mt-3 text-lg font-black leading-8 text-zinc-900">{activeBiography.lesson}</p>
                </div>
                <div className="rounded-3xl border border-white/80 bg-white/80 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Grounding read</p>
                  <p className="mt-3 text-sm font-medium leading-7 text-zinc-600">{activeBiography.story}</p>
                </div>
              </div>
            </motion.div>
          )}

          {viewMode === 'facts' && (
            <motion.div
              key={activeFact}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-[2rem] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-yellow-50 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-600">Cool fact</p>
                  <h3 className="mt-2 text-3xl font-black text-zinc-900">A useful brain reminder</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setFactIndex((current) => (current + 1) % soothingFacts.length)}
                  className="rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-black text-amber-700 transition hover:bg-amber-50"
                >
                  Next fact
                </button>
              </div>
              <div className="mt-6 rounded-3xl border border-white/80 bg-white/80 p-6">
                <p className="text-xl font-black leading-9 text-zinc-900">{activeFact}</p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {encouragements.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/80 bg-white/70 px-4 py-4 text-sm font-bold leading-6 text-zinc-700">
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {viewMode === 'future' && (
            <motion.div
              key={activeFuture.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-[2rem] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">Future view</p>
                  <h3 className="mt-2 text-3xl font-black text-zinc-900">{activeFuture.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setFutureIndex((current) => (current + 1) % futureScenes.length)}
                  className="rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-black text-sky-700 transition hover:bg-sky-50"
                >
                  Next view
                </button>
              </div>
              <div className="mt-6 rounded-3xl border border-white/80 bg-white/80 p-6">
                <p className="text-base font-medium leading-8 text-zinc-700">{activeFuture.text}</p>
              </div>
              <div className="mt-5 flex items-center gap-3 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5">
                <Star className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-bold leading-6 text-zinc-700">
                  School effort is not only about marks. It builds attention, self-trust, and options.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          {
            title: 'Reset your standards for today',
            text: 'Aim for one completed block, not a perfect day. Reduced pressure often produces better work.',
            icon: Brain,
          },
          {
            title: 'Use evidence against panic',
            text: 'Look at finished tasks, saved notes, and completed study sessions. Evidence is more reliable than an overwhelmed feeling.',
            icon: Quote,
          },
          {
            title: 'Return with one next step',
            text: 'Pick the next visible task and re-enter the planner. Small clarity is more useful than big motivation speeches.',
            icon: ArrowRight,
          },
        ].map((card) => (
          <div key={card.title} className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
              <card.icon size={20} />
            </div>
            <h3 className="mt-5 text-xl font-black text-zinc-900">{card.title}</h3>
            <p className="mt-3 text-sm font-medium leading-7 text-zinc-600">{card.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
