import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Smile, Frown, Meh, Angry, Zap, Coffee, BarChart3, List } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from '@/lib/portal-firestore';
import { onAuthStateChanged } from 'firebase/auth';

const emotions = [
  { name: 'Happy', short: 'Hap', icon: Smile, color: '#22c55e' },
  { name: 'Calm', short: 'Cal', icon: Coffee, color: '#60a5fa' },
  { name: 'Neutral', short: 'Neu', icon: Meh, color: '#facc15' },
  { name: 'Anxious', short: 'Anx', icon: Zap, color: '#fb923c' },
  { name: 'Sad', short: 'Sad', icon: Frown, color: '#f43f5e' },
  { name: 'Angry', short: 'Ang', icon: Angry, color: '#a855f7' },
];

export function MoodHistoryChart() {
  const [moodData, setMoodData] = useState(emotions.map(e => ({ name: e.short, count: 0 })));
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('chart');

  useEffect(() => {
    let unsubscribeSnapshot = () => {};
    
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const docRef = doc(db, 'mood_logs', user.uid);
        
        // Use onSnapshot for real-time updates
        unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setMoodData(emotions.map(e => ({ name: e.short, count: data[e.short] || 0 })));
          } else {
            setDoc(docRef, Object.fromEntries(emotions.map(e => [e.short, 0])));
          }
        });
      } else {
        unsubscribeSnapshot();
        unsubscribeSnapshot = () => {};
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot();
    };
  }, []);

  return (
    <Card className="h-full overflow-hidden rounded-3xl border border-white/60 bg-white/35 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Smile className="h-4 w-4 text-emerald-500" />
          Mood History
        </CardTitle>
        <div className="flex gap-1">
          <button onClick={() => setViewMode('list')} className={`p-1 rounded ${viewMode === 'list' ? 'bg-zinc-100' : ''}`}><List className="h-4 w-4 text-zinc-500" /></button>
          <button onClick={() => setViewMode('chart')} className={`p-1 rounded ${viewMode === 'chart' ? 'bg-zinc-100' : ''}`}><BarChart3 className="h-4 w-4 text-zinc-500" /></button>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === 'chart' ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moodData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <YAxis hide />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {moodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={emotions[index].color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex flex-col justify-center gap-2">
            {moodData.map((m) => (
              <div key={m.name} className="flex justify-between text-sm font-bold">
                <span className="text-zinc-500">{emotions.find(e => e.short === m.name)?.name}</span>
                <span className="text-zinc-900">{m.count}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
