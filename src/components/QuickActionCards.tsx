import React from 'react';
import { Target, CheckCircle2, TrendingUp, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ACTION_CARDS = [
  {
    id: 'focus-task',
    title: 'Focus Task',
    description: 'Finish your Math revision for the upcoming quiz.',
    subtext: 'Small steps lead to big progress. Keep going!',
    icon: <Target className="h-10 w-10 text-blue-500" />,
    buttonText: 'Shuffle Focus',
    buttonClass: 'bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-lg shadow-blue-200',
    iconBg: 'bg-blue-50',
  },
  {
    id: 'daily-challenge',
    title: 'Daily Challenge',
    description: 'Complete one extra practice problem.',
    subtext: 'One small win can change your day.',
    icon: <CheckCircle2 className="h-10 w-10 text-teal-500" />,
    buttonText: '✓ Mark as Done',
    buttonClass: 'bg-gradient-to-r from-teal-400 to-teal-600 hover:from-teal-500 hover:to-teal-700 text-white shadow-lg shadow-teal-200',
    iconBg: 'bg-teal-50',
  },
  {
    id: 'my-progress',
    title: 'My Progress',
    description: 'Track weekly performance & growth.',
    subtext: 'Visualise how your effort turns into consistent improvement over time.',
    icon: <TrendingUp className="h-10 w-10 text-indigo-500" />,
    buttonText: 'View Details',
    buttonClass: 'bg-gradient-to-r from-indigo-400 to-indigo-600 hover:from-indigo-500 hover:to-indigo-700 text-white shadow-lg shadow-indigo-200',
    iconBg: 'bg-indigo-50',
  },
  {
    id: 'class-progress',
    title: 'Class Progress',
    description: 'Compare your study progress by subject.',
    subtext: 'Stay on track with classes through the whole term – have a look at your track and stay on top of it.',
    icon: <BarChart3 className="h-10 w-10 text-orange-500" />,
    buttonText: 'Open Insights',
    buttonClass: 'bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white shadow-lg shadow-orange-200',
    iconBg: 'bg-orange-50',
  },
];

export function QuickActionCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {ACTION_CARDS.map((card) => (
        <Card key={card.id} className="border-none shadow-xl shadow-zinc-200/50 bg-white rounded-[40px] overflow-hidden transition-all hover:shadow-2xl hover:shadow-zinc-300/50 hover:-translate-y-1">
          <CardContent className="p-10 flex flex-col items-center text-center space-y-8">
            <div className={cn("p-6 rounded-full ring-8 ring-zinc-50/50 shadow-inner", card.iconBg)}>
              {card.icon}
            </div>
            
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{card.title}</h3>
              <p className="text-zinc-600 font-medium leading-relaxed px-4 text-base">
                {card.description}
              </p>
              <p className="text-zinc-400 italic text-sm font-medium">
                {card.subtext}
              </p>
            </div>

            <Button className={cn("w-full h-16 rounded-3xl text-lg font-bold transition-all", card.buttonClass)}>
              {card.buttonText}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
