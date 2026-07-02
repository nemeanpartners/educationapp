import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const waveform = [
  { value: 16, color: 'bg-sky-400' },
  { value: 38, color: 'bg-emerald-400' },
  { value: 58, color: 'bg-cyan-400' },
  { value: 28, color: 'bg-amber-300' },
  { value: 82, color: 'bg-violet-400' },
  { value: 46, color: 'bg-fuchsia-400' },
  { value: 64, color: 'bg-rose-400' },
  { value: 34, color: 'bg-sky-400' },
  { value: 54, color: 'bg-emerald-400' },
  { value: 72, color: 'bg-cyan-400' },
  { value: 42, color: 'bg-amber-300' },
  { value: 22, color: 'bg-violet-400' },
  { value: 55, color: 'bg-fuchsia-400' },
  { value: 88, color: 'bg-rose-400' },
  { value: 62, color: 'bg-sky-400' },
  { value: 36, color: 'bg-emerald-400' },
  { value: 49, color: 'bg-cyan-400' },
  { value: 76, color: 'bg-amber-300' },
  { value: 57, color: 'bg-violet-400' },
  { value: 41, color: 'bg-fuchsia-400' },
];

const dayMix = [
  { day: 'Mon', focus: 3.5, review: 1.5, color: 'from-sky-600 to-sky-400' },
  { day: 'Tue', focus: 4.2, review: 2.1, color: 'from-emerald-600 to-emerald-400' },
  { day: 'Wed', focus: 2.4, review: 1.1, color: 'from-amber-500 to-amber-300' },
  { day: 'Thu', focus: 4.8, review: 2.6, color: 'from-violet-600 to-violet-400' },
  { day: 'Fri', focus: 3.1, review: 1.8, color: 'from-rose-600 to-rose-400' },
  { day: 'Sat', focus: 4.4, review: 2.9, color: 'from-orange-600 to-amber-400' },
  { day: 'Sun', focus: 2.9, review: 1.3, color: 'from-fuchsia-600 to-fuchsia-400' },
];

export function WeeklyActivityChartPanel() {
  return (
    <div className="relative mx-auto w-full max-w-[430px] overflow-hidden rounded-[22px] border border-white/55 bg-white/24 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.32),_transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.02))] backdrop-blur-[3px]" />
      <div className="relative z-10">
        <div className="inline-flex rounded-full border border-white/55 bg-white/30 px-3 py-1 backdrop-blur-md">
          <h3 className="text-xs font-black uppercase tracking-[0.22em] text-zinc-600">Weekly Activity</h3>
        </div>
        <div className="mt-3 flex h-[104px] items-center justify-center gap-1 px-1">
          {waveform.map((item, i) => (
            <div
              key={i}
              className={`group relative flex-1 ${item.color} rounded-full transition-all duration-500 hover:brightness-110`}
              style={{ height: `${item.value}%` }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="text-[8px] font-black text-zinc-800">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FocusVsReviewChart() {
  return (
    <Card className="relative overflow-hidden rounded-[34px] border border-white/70 bg-white/34 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.36),_transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02))] backdrop-blur-[3px]" />
      <CardHeader className="relative z-10 pb-1 pt-4">
        <div className="inline-flex w-fit rounded-full border border-white/55 bg-white/30 px-3 py-1 backdrop-blur-md">
          <CardTitle className="text-xs font-black uppercase tracking-[0.22em] text-zinc-600">Focus vs Review</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 flex min-h-[420px] flex-1 flex-col pb-5 pt-3">
        <div className="flex h-full flex-1 flex-col justify-evenly gap-5 py-2">
          {dayMix.map((item) => (
            <div key={item.day} className="grid grid-cols-[36px_1fr_auto] items-center gap-3">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-600">{item.day}</span>
              <div className="h-4 overflow-hidden rounded-full bg-white/75 shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)]">
                <div className="flex h-full">
                  <div className={`bg-gradient-to-r ${item.color}`} style={{ width: `${item.focus * 12}%` }} />
                  <div className="bg-zinc-900/18" style={{ width: `${item.review * 12}%` }} />
                </div>
              </div>
              <span className="text-sm font-black text-zinc-600">{(item.focus + item.review).toFixed(1)}h</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function WeeklyWaveformChart() {

  return (
    <Card className="overflow-hidden rounded-3xl border border-white/60 bg-white/35 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-400">Weekly Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-24 flex items-center justify-center gap-1.5 px-2">
          {waveform.map((item, i) => (
            <div
              key={i}
              className={`group relative flex-1 ${item.color} rounded-full transition-all duration-500 hover:brightness-110`}
              style={{ height: `${item.value}%` }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="text-[8px] font-black text-zinc-900">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
