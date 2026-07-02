import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function StudyPet() {
  return (
    <Card className="overflow-hidden rounded-3xl border border-white/60 bg-white/35 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-400">Study Buddy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="group flex h-40 flex-col items-center justify-center rounded-3xl border border-white/50 bg-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl transition-colors hover:bg-white/40">
          <span className="text-5xl group-hover:scale-110 transition-transform duration-300">🐱</span>
          <p className="mt-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Happy & Healthy</p>
        </div>
      </CardContent>
    </Card>
  );
}
