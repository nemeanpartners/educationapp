import { Gamepad2, MessageSquare } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { detectStudentPortalFromPath, studentPortalPath } from '../lib/portal';

const socialCards = [
  {
    title: 'Games',
    subtitle: 'Microlearning',
    description: 'Jump into memory cards, knowledge tree, and quick learning games.',
    icon: Gamepad2,
    path: '/games',
    accent: 'bg-indigo-600',
    soft: 'bg-indigo-50',
    text: 'text-indigo-600',
  },
  {
    title: 'Chat',
    subtitle: 'Messages',
    description: 'Open the student chat space.',
    icon: MessageSquare,
    path: '/community',
    accent: 'bg-purple-600',
    soft: 'bg-purple-50',
    text: 'text-purple-600',
  },
];

export default function SocialPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const cards = socialCards.map((card) => ({
    ...card,
    path: studentPortalPath(activePortal, card.path),
  }));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">Social</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-900">Connect and learn</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium text-zinc-500">
          Use social tools for quick practice and student communication.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              key={card.title}
              type="button"
              onClick={() => navigate(card.path)}
              className="group min-h-64 rounded-3xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${card.soft} ${card.text}`}>
                <Icon size={28} />
              </div>
              <div className="mt-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{card.subtitle}</p>
                <h2 className="mt-2 text-2xl font-black text-zinc-900">{card.title}</h2>
                <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-zinc-500">{card.description}</p>
              </div>
              <div className={`mt-8 inline-flex rounded-2xl px-4 py-3 text-sm font-black text-white transition group-hover:scale-[1.02] ${card.accent}`}>
                Open {card.title}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
