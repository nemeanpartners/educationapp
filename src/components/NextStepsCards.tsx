import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/portal-firestore';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { CheckSquare, BookOpen, ClipboardList, ChevronRight, Loader2 } from 'lucide-react';
import { TodoTask, Deadline } from '../types';
import { cn } from '../lib/utils';
import { detectStudentPortalFromPath, studentPortalToolPath } from '../lib/portal';

export function NextStepsCards() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const [todos, setTodos] = useState<TodoTask[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const todosQuery = query(
      collection(db, 'todos'),
      where('userId', '==', user.uid),
      where('completed', '==', false),
      orderBy('createdAt', 'desc')
    );

    const deadlinesQuery = query(
      collection(db, 'deadlines'),
      where('userId', '==', user.uid),
      where('completed', '==', false),
      orderBy('dueDate', 'asc')
    );

    const unsubTodos = onSnapshot(todosQuery, (snapshot) => {
      setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TodoTask)));
    });

    const unsubDeadlines = onSnapshot(deadlinesQuery, (snapshot) => {
      setDeadlines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deadline)));
      setLoading(false);
    });

    return () => {
      unsubTodos();
      unsubDeadlines();
    };
  }, []);

  const nextTodo = todos[0];
  const nextAssignment = deadlines.find(d => d.type === 'assignment');

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map(i => (
          <Card key={i} className="flex h-32 animate-pulse items-center justify-center rounded-3xl border border-white/60 bg-white/35 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-200" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Next Task */}
      <Card 
        onClick={() => navigate(studentPortalToolPath(activePortal, 'todo'))}
        className="group relative cursor-pointer overflow-hidden rounded-[32px] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl transition-all hover:-translate-y-0.5 hover:bg-white/45"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
            <CheckSquare size={24} />
          </div>
          <ChevronRight className="text-zinc-300 group-hover:text-indigo-600 transition-colors" />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">Next Task</h3>
          <p className="text-lg font-black text-zinc-900 line-clamp-1">
            {nextTodo ? nextTodo.text : "All caught up!"}
          </p>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
            {nextTodo ? "Priority: High" : "Great job!"}
          </p>
        </div>
      </Card>

      {/* Next Assignment */}
      <Card 
        onClick={() => navigate(studentPortalToolPath(activePortal, 'deadlines'))}
        className="group relative cursor-pointer overflow-hidden rounded-[32px] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl transition-all hover:-translate-y-0.5 hover:bg-white/45"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <ClipboardList size={24} />
          </div>
          <ChevronRight className="text-zinc-300 group-hover:text-emerald-600 transition-colors" />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">Next Assignment</h3>
          <p className="text-lg font-black text-zinc-900 line-clamp-1">
            {nextAssignment ? nextAssignment.title : "No assignments"}
          </p>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
            {nextAssignment ? `Due: ${nextAssignment.dueDate}` : "None due"}
          </p>
        </div>
      </Card>

      {/* AI Recommendation */}
      <Card 
        onClick={() => navigate(studentPortalToolPath(activePortal, 'study'))}
        className="group relative cursor-pointer overflow-hidden rounded-[32px] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl transition-all hover:-translate-y-0.5 hover:bg-white/45"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="rounded-2xl bg-amber-50 p-3 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all">
            <BookOpen size={24} />
          </div>
          <ChevronRight className="text-zinc-300 group-hover:text-amber-600 transition-colors" />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">AI Suggestion</h3>
          <p className="text-lg font-black text-zinc-900 line-clamp-1">
            Review Flashcards
          </p>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
            Based on your progress
          </p>
        </div>
      </Card>
    </div>
  );
}
