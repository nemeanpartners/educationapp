import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { detectStudentPortalFromPath, studentPortalPath } from '@/lib/portal';
import { useTodoStore } from '../hooks/use-todo-store';
import { useAcademicGoalsStore } from '../hooks/use-academic-goals-store';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import pineTreeLog from '../../pinetreelog.png';
import bushyTreeLog from '../../bushytreelog.png';
import palmTreeLog from '../../palmtreelog.png';

function seededUnit(seed: number) {
  const value = Math.sin(seed * 999.91) * 43758.5453123;
  return value - Math.floor(value);
}

export default function ForestWorldPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const portal = detectStudentPortalFromPath(location.pathname);
  const { isPhone } = useResponsiveDevice();
  const todos = useTodoStore((state) => state.todos);
  const goals = useAcademicGoalsStore((state) => state.goals);
  const completedTodos = todos.filter((todo) => todo.completed);
  const completedGoals = goals.filter((goal) => goal.completed);
  const rewardTreeCount = Math.max(0, completedTodos.length + completedGoals.length * 2);
  const treeCount = 3 + rewardTreeCount;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const groveSpecies = [
    { key: 'pine', src: pineTreeLog, name: 'Pine', width: 96, height: 136 },
    { key: 'bushy', src: bushyTreeLog, name: 'Bush tree', width: 116, height: 126 },
    { key: 'palm', src: palmTreeLog, name: 'Palm', width: 78, height: 156 },
  ] as const;

  const trees = useMemo(() => (
    Array.from({ length: treeCount }, (_, index) => {
      const starter = index < groveSpecies.length;
      const species = starter ? groveSpecies[index] : groveSpecies[Math.floor(seededUnit(index + 17) * groveSpecies.length)];
      const seed = index + 1;
      return {
        id: `${species.key}-${index}`,
        src: species.src,
        name: species.name,
        left: 8 + seededUnit(seed * 1.7) * 84,
        top: 16 + seededUnit(seed * 2.3) * 68,
        scale: starter ? 0.92 + index * 0.04 : 0.78 + seededUnit(seed * 3.1) * 0.42,
        rotate: (seededUnit(seed * 5.2) - 0.5) * 9,
        opacity: 0.9 + seededUnit(seed * 4.1) * 0.08,
        zIndex: 10 + Math.round(16 + seededUnit(seed * 2.9) * 60),
        width: species.width,
        height: species.height,
      };
    })
  ), [treeCount]);

  const zoomIn = () => setZoom((current) => Math.min(1.9, current + 0.12));
  const zoomOut = () => setZoom((current) => Math.max(0.82, current - 0.12));
  const panWorld = (x: number, y: number) => {
    setPan((current) => ({
      x: Math.max(-20, Math.min(20, current.x + x)),
      y: Math.max(-20, Math.min(20, current.y + y)),
    }));
  };
  const resetCamera = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className={isPhone ? 'p-4' : 'p-8'}>
      <section className="overflow-hidden rounded-[36px] border border-[#7dc69a] bg-[radial-gradient(circle_at_top,rgba(222,255,233,0.24),transparent_26%),linear-gradient(180deg,#edf8f0_0%,#b9dfc0_18%,#6aa676_54%,#2f6941_86%,#173523_100%)] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <button
              onClick={() => navigate(studentPortalPath(portal, '/progress-uni?view=forest'))}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-950/10 bg-white/65 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-950 transition hover:bg-white/85"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to progress
            </button>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-emerald-950 sm:text-4xl">Forest world</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-emerald-950/72 sm:text-base">
              This is the dedicated rainforest view. Use the camera controls here instead of loading those interactions inside the dashboard card.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[30rem]">
            <div className="rounded-[24px] border border-emerald-950/10 bg-white/24 p-4 backdrop-blur-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-950/55">Trees planted</p>
              <p className="mt-2 text-3xl font-black text-emerald-950">{treeCount}</p>
            </div>
            <div className="rounded-[24px] border border-emerald-950/10 bg-white/24 p-4 backdrop-blur-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-950/55">Camera zoom</p>
              <p className="mt-2 text-3xl font-black text-emerald-950">{zoom.toFixed(2)}x</p>
            </div>
            <div className="rounded-[24px] border border-emerald-950/10 bg-white/24 p-4 backdrop-blur-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-950/55">Starter set</p>
              <p className="mt-2 text-lg font-black text-emerald-950">Pine · Bush · Palm</p>
            </div>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-[30px] border border-white/20 bg-[linear-gradient(180deg,rgba(234,255,240,0.18)_0%,rgba(62,126,80,0.22)_46%,rgba(16,42,28,0.42)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          <div className={isPhone ? 'space-y-4' : 'grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]'}>
            <div className="space-y-3">
              <div className="rounded-[24px] border border-white/15 bg-[#10281b]/72 p-4 text-emerald-50 backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100/72">Camera controls</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={zoomIn} className="flex-1 rounded-xl border border-white/10 bg-white/6 px-3 py-3 text-[10px] font-black uppercase tracking-[0.14em] transition hover:bg-white/12">
                    <Plus className="mx-auto h-4 w-4" />
                  </button>
                  <button onClick={zoomOut} className="flex-1 rounded-xl border border-white/10 bg-white/6 px-3 py-3 text-[10px] font-black uppercase tracking-[0.14em] transition hover:bg-white/12">
                    <Minus className="mx-auto h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div />
                  <button onClick={() => panWorld(0, -4)} className="rounded-xl border border-white/10 bg-white/6 px-3 py-3 text-sm font-black transition hover:bg-white/12">↑</button>
                  <div />
                  <button onClick={() => panWorld(-4, 0)} className="rounded-xl border border-white/10 bg-white/6 px-3 py-3 text-sm font-black transition hover:bg-white/12">←</button>
                  <button onClick={resetCamera} className="rounded-xl border border-white/10 bg-white/6 px-3 py-3 text-[10px] font-black uppercase tracking-[0.14em] transition hover:bg-white/12">Reset</button>
                  <button onClick={() => panWorld(4, 0)} className="rounded-xl border border-white/10 bg-white/6 px-3 py-3 text-sm font-black transition hover:bg-white/12">→</button>
                  <div />
                  <button onClick={() => panWorld(0, 4)} className="rounded-xl border border-white/10 bg-white/6 px-3 py-3 text-sm font-black transition hover:bg-white/12">↓</button>
                  <div />
                </div>
              </div>

              <div className="rounded-[24px] border border-white/15 bg-[#10281b]/72 p-4 text-emerald-50 backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100/72">Next step</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-emerald-50/78">
                  This page is ready for later upgrades like user-picked backgrounds, reward-to-species rules, and a real persistent forest layout.
                </p>
              </div>
            </div>

            <div className={isPhone ? 'h-[34rem]' : 'h-[44rem]'}>
              <div className="relative h-full overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,#d7ecd6_0%,#c8e0c6_10%,#4b8458_34%,#1c4b2e_68%,#0a2013_100%)]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.34),transparent_18%),radial-gradient(circle_at_72%_16%,rgba(229,255,238,0.14),transparent_15%)]" />
                <div
                  className="absolute left-1/2 top-1/2 h-[185%] w-[185%] origin-center"
                  style={{
                    transform: `translate(calc(-50% + ${pan.x}% ), calc(-50% + ${pan.y}%)) scale(${zoom})`,
                  }}
                >
                  {trees.map((tree) => (
                    <div
                      key={tree.id}
                      className="absolute flex items-end justify-center"
                      style={{
                        left: `${tree.left}%`,
                        top: `${tree.top}%`,
                        width: tree.width,
                        height: tree.height,
                        zIndex: tree.zIndex,
                        transform: `translate(-50%, -78%) rotate(${tree.rotate}deg) scale(${tree.scale})`,
                        opacity: tree.opacity,
                      }}
                    >
                      <div className="absolute bottom-1 h-[14%] w-[56%] rounded-full bg-black/24 blur-[8px]" />
                      <img src={tree.src} alt={tree.name} className="relative h-full w-full object-contain saturate-[1.02] drop-shadow-[0_16px_20px_rgba(5,20,12,0.28)]" />
                    </div>
                  ))}
                </div>
                <div className="pointer-events-none absolute right-5 top-5 rounded-full border border-white/20 bg-[#163222]/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-50 backdrop-blur-md">
                  Full world view
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
