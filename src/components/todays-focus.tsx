import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function TodaysFocus() {
  return (
    <Card className="overflow-hidden rounded-3xl border border-white/60 bg-white/35 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-400">Daily Focus</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input 
            placeholder="Main goal for today?" 
            className="h-12 rounded-2xl border border-white/55 bg-white/35 font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl transition-colors focus:border-indigo-500"
          />
          <Button size="icon" className="h-12 w-12 rounded-2xl border border-white/35 bg-zinc-900/80 text-white shadow-[0_14px_28px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-xl transition-transform hover:scale-105">
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
