import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocation } from 'react-router-dom';
import { detectStudentPortalFromPath } from '@/lib/portal';

export function ClassProgressChart() {
  const location = useLocation();
  const isUniversityPortal = detectStudentPortalFromPath(location.pathname) === 'university';
  const subjects = [
    { name: 'Math', progress: 75, color: 'bg-indigo-500' },
    { name: 'History', progress: 80, color: 'bg-emerald-500' },
    { name: 'Science', progress: 85, color: 'bg-amber-500' }
  ];

  return (
    <Card className="overflow-hidden rounded-3xl border border-white/60 bg-white/35 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-400">{isUniversityPortal ? 'Course Standing' : 'Class Progress'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {subjects.map((subject, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-zinc-900">{subject.name}</span>
                <span className="text-[10px] font-black text-zinc-400">{subject.progress}%</span>
              </div>
              <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${subject.color} transition-all duration-1000`} 
                  style={{ width: `${subject.progress}%` }} 
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
