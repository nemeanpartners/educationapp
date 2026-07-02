import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, CheckCircle2 } from 'lucide-react';

export function DailyHomeworkPlan() {
  const plans = [
    { subject: 'Math Assignment', time: '14:00', status: 'pending' },
    { subject: 'History Reading', time: '16:30', status: 'completed' }
  ];

  return (
    <Card className="overflow-hidden rounded-3xl border border-white/60 bg-white/35 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-400">Homework Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {plans.map((plan, i) => (
            <div 
              key={i} 
              className="group flex cursor-pointer items-center justify-between rounded-2xl border border-white/45 bg-white/30 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_10px_26px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-colors hover:bg-white/45"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/45 bg-white/35 text-zinc-400 shadow-sm backdrop-blur-xl transition-colors group-hover:text-zinc-900">
                  <BookOpen size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-900">{plan.subject}</p>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{plan.time}</p>
                </div>
              </div>
              <CheckCircle2 size={18} className={plan.status === 'completed' ? "text-emerald-500" : "text-zinc-200"} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
