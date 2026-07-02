import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const dayData = [
  { day: 'M', goal: 88, actual: 54, tint: 'from-sky-300/55 to-sky-100/40', fill: 'from-sky-700 to-sky-500', accent: 'text-sky-800' },
  { day: 'T', goal: 82, actual: 71, tint: 'from-emerald-300/55 to-emerald-100/40', fill: 'from-emerald-700 to-emerald-500', accent: 'text-emerald-800' },
  { day: 'W', goal: 84, actual: 34, tint: 'from-amber-300/55 to-amber-100/40', fill: 'from-amber-600 to-amber-400', accent: 'text-amber-800' },
  { day: 'T', goal: 86, actual: 79, tint: 'from-violet-300/55 to-violet-100/40', fill: 'from-violet-700 to-violet-500', accent: 'text-violet-800' },
  { day: 'F', goal: 80, actual: 63, tint: 'from-rose-300/55 to-rose-100/40', fill: 'from-rose-700 to-rose-500', accent: 'text-rose-800' },
  { day: 'S', goal: 81, actual: 75, tint: 'from-cyan-300/55 to-cyan-100/40', fill: 'from-cyan-700 to-cyan-500', accent: 'text-cyan-800' },
  { day: 'S', goal: 84, actual: 58, tint: 'from-fuchsia-300/55 to-fuchsia-100/40', fill: 'from-fuchsia-700 to-fuchsia-500', accent: 'text-fuchsia-800' },
];

export function GoalsVsActualChartPanel() {
  return (
    <div className="relative mx-auto w-full max-w-[430px] overflow-hidden rounded-[22px] border border-white/55 bg-white/24 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.32),_transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.02))] backdrop-blur-[3px]" />
      <div className="relative z-10">
        <div className="inline-flex rounded-full border border-white/55 bg-white/30 px-3 py-1 backdrop-blur-md">
          <h3 className="text-xs font-black uppercase tracking-[0.22em] text-zinc-600">Goals vs Actual</h3>
        </div>
        <div className="mt-3 flex h-[132px] items-end justify-around gap-2.5 px-1 pb-1">
          {dayData.map((item, i) => (
            <div key={i} className={`group relative h-full flex-1 overflow-hidden rounded-[20px] bg-gradient-to-b ${item.tint}`}>
              <div
                className={`absolute bottom-0 left-0 right-0 rounded-[20px] bg-gradient-to-b ${item.fill} transition-all duration-700 ease-out group-hover:brightness-110`}
                style={{ height: `${item.actual}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-black text-white">
                  {item.actual}% / {item.goal}%
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between px-1">
          {dayData.map((item, i) => (
            <span key={`${item.day}-${i}`} className={`w-full text-center text-xs font-black ${item.accent}`}>
              {item.day}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GoalsVsActualChart() {
  const dayData = [
    { day: 'M', goal: 88, actual: 54, tint: 'from-sky-300/55 to-sky-100/40', fill: 'from-sky-700 to-sky-500', accent: 'text-sky-700' },
    { day: 'T', goal: 82, actual: 71, tint: 'from-emerald-300/55 to-emerald-100/40', fill: 'from-emerald-700 to-emerald-500', accent: 'text-emerald-700' },
    { day: 'W', goal: 84, actual: 34, tint: 'from-amber-300/55 to-amber-100/40', fill: 'from-amber-600 to-amber-400', accent: 'text-amber-700' },
    { day: 'T', goal: 86, actual: 79, tint: 'from-violet-300/55 to-violet-100/40', fill: 'from-violet-700 to-violet-500', accent: 'text-violet-700' },
    { day: 'F', goal: 80, actual: 63, tint: 'from-rose-300/55 to-rose-100/40', fill: 'from-rose-700 to-rose-500', accent: 'text-rose-700' },
    { day: 'S', goal: 81, actual: 75, tint: 'from-cyan-300/55 to-cyan-100/40', fill: 'from-cyan-700 to-cyan-500', accent: 'text-cyan-700' },
    { day: 'S', goal: 84, actual: 58, tint: 'from-fuchsia-300/55 to-fuchsia-100/40', fill: 'from-fuchsia-700 to-fuchsia-500', accent: 'text-fuchsia-700' },
  ];

  return (
    <Card className="overflow-hidden rounded-3xl border border-white/60 bg-white/35 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-400">Goals vs Actual</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48 flex items-end justify-around gap-4 pb-2 px-2">
          {dayData.map((item, i) => (
            <div key={i} className={`flex-1 bg-gradient-to-b ${item.tint} rounded-2xl relative group h-full overflow-hidden`}>
              <div
                className={`absolute bottom-0 left-0 right-0 bg-gradient-to-b ${item.fill} rounded-2xl transition-all duration-700 ease-out group-hover:brightness-110`}
                style={{ height: `${item.actual}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-black text-white">{item.actual}% / {item.goal}%</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between px-2">
          {dayData.map((item, i) => (
            <span key={`${item.day}-${i}`} className={`w-full text-center text-[10px] font-black ${item.accent}`}>{item.day}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
