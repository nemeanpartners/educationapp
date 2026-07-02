import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Sun } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { detectStudentPortalFromPath, studentPortalToolPath } from '@/lib/portal';

export default function PlanDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-4xl font-black text-zinc-900 tracking-tight">Planner Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="cursor-pointer hover:shadow-xl transition-all border-none shadow-lg" onClick={() => navigate(studentPortalToolPath(activePortal, 'homework-planner'))}>
          <CardContent className="p-6 space-y-4">
            <div className="p-3 bg-indigo-50 w-fit rounded-2xl text-indigo-600">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold">Homework Planner</h2>
            <p className="text-zinc-500">Manage your weekly homework schedule and timetable.</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-xl transition-all border-none shadow-lg" onClick={() => navigate(studentPortalToolPath(activePortal, 'daily-planner'))}>
          <CardContent className="p-6 space-y-4">
            <div className="p-3 bg-sky-50 w-fit rounded-2xl text-sky-600">
              <Sun className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold">Daily Planner</h2>
            <p className="text-zinc-500">Plan your daily tasks, activities, and focus sessions.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
