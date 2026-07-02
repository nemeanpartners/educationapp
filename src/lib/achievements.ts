export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  progress: number;
  maxProgress: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-login',
    title: 'Welcome!',
    description: 'Log in for the first time',
    icon: '👋',
    progress: 1,
    maxProgress: 1,
  },
  {
    id: 'study-streak-3',
    title: 'Consistent',
    description: 'Study for 3 days in a row',
    icon: '🔥',
    progress: 0,
    maxProgress: 3,
  },
  {
    id: 'first-quiz',
    title: 'Quiz Whiz',
    description: 'Complete your first quiz',
    icon: '🧠',
    progress: 0,
    maxProgress: 1,
  },
];
