import { Link, useNavigate } from 'react-router-dom';

const features = [
  ['Smart Planning', 'Plan classes, tasks, revision blocks, and deadlines from one student workspace.'],
  ['AI Study Tools', 'Turn notes, uploaded files, and topics into flashcards, quizzes, mind maps, and explanations.'],
  ['High School + University', 'Choose the portal that matches the student level and keep the workspace focused.'],
  ['Document Workflow', 'Use assignment support, rubric checks, workbook tools, and Microsoft Word integration.'],
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#05060a] font-sans text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05060a]/80 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link to="/landing" className="flex min-w-0 items-center gap-3">
            <img src="/edurevlogoimage.png" alt="EducationRev logo" className="h-11 w-11 object-contain" />
            <span className="truncate text-2xl font-black tracking-tight">EducationRev</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-bold text-slate-300 sm:flex">
            <a href="#features">Features</a>
            <a href="#support">Support</a>
            <Link to="/privacy">Privacy</Link>
          </nav>
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-black text-slate-950 shadow-lg shadow-cyan-400/20 transition hover:-translate-y-0.5"
          >
            Open App
          </button>
        </div>
      </header>

      <section className="relative overflow-hidden px-5 py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_0%,rgba(155,140,255,0.24),transparent_38%),radial-gradient(circle_at_10%_25%,rgba(124,246,255,0.18),transparent_34%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
              Study Smarter. Stress Less.
            </p>
            <h1 className="mt-7 text-5xl font-black leading-none tracking-tight sm:text-7xl">
              EducationRev
            </h1>
            <p className="mt-7 max-w-2xl text-lg font-semibold leading-8 text-slate-300">
              EducationRev helps high school and university students organise study, understand assignments, revise from notes, and stay on top of progress with focused AI learning tools.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/auth')}
                className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-100"
              >
                Choose Student Portal
              </button>
              <a
                href="#features"
                className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10"
              >
                View Features
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map(([title, body]) => (
                <div key={title} className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
                  <p className="text-lg font-black">{title}</p>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Built for planning, revision, assignments, and student momentum.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {['Upload notes and generate revision material.', 'Track classes, deadlines, tasks, and progress.', 'Move between high school and university workflows.'].map((item) => (
              <div key={item} className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                <p className="text-lg font-bold leading-7 text-slate-100">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="support" className="px-5 py-20">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center">
          <h2 className="text-4xl font-black tracking-tight">Need help?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-300">
            Contact EducationRev support for account access, app behaviour, privacy, and workspace questions.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950" to="/support">
              Support Page
            </Link>
            <Link className="rounded-full border border-white/15 px-6 py-3 text-sm font-black text-white" to="/privacy">
              Privacy Policy
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-sm font-semibold text-slate-400">
        <p>© 2026 EducationRev · Student-side education platform.</p>
      </footer>
    </main>
  );
}
