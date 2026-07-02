import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Smile, Frown, Meh, Angry, Zap, Coffee } from 'lucide-react';
import { cn } from '../lib/utils';
import { db, auth } from '../firebase';
import { doc, getDoc, increment, setDoc, updateDoc, serverTimestamp } from '@/lib/portal-firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { MonthlyMoodChart } from './my-progress/monthly-mood-chart';

const emotions = [
  { name: 'Happy', short: 'Hap', icon: Smile, color: '#22c55e', value: 5 },
  { name: 'Calm', short: 'Cal', icon: Coffee, color: '#60a5fa', value: 4 },
  { name: 'Neutral', short: 'Neu', icon: Meh, color: '#facc15', value: 3 },
  { name: 'Anxious', short: 'Anx', icon: Zap, color: '#fb923c', value: 2 },
  { name: 'Sad', short: 'Sad', icon: Frown, color: '#f43f5e', value: 1 },
  { name: 'Angry', short: 'Ang', icon: Angry, color: '#a855f7', value: 0 },
];

export default function MoodLogsPage() {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodData, setMoodData] = useState(
    emotions.map(e => ({ name: e.short, count: 0 }))
  );
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const docRef = doc(db, 'mood_logs', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMoodData(emotions.map(e => ({ name: e.short, count: data[e.short] || 0 })));
        } else {
          // Initialize with 0s
          await setDoc(docRef, Object.fromEntries(emotions.map(e => [e.short, 0])));
        }
      } else {
        setUserId(null);
      }
    });
    return unsubscribe;
  }, []);

  const formatLocalDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handleLogMood = async (moodName: string) => {
    if (!userId) return;
    setSelectedMood(moodName);
    const shortName = emotions.find(e => e.name === moodName)?.short;
    if (!shortName) return;

    const docRef = doc(db, 'mood_logs', userId);
    const dateKey = formatLocalDateKey(new Date());

    // Optimistic UI update
    setMoodData(prev =>
      prev.map(item => (item.name === shortName ? { ...item, count: item.count + 1 } : item))
    );

    // Persist:
    // - overall counter increment
    // - per-day counter increment (supports multiple logs per day)
    // - timestamps for audit/display
    await updateDoc(docRef, {
      [shortName]: increment(1),
      [`dailyCounts.${dateKey}.${shortName}`]: increment(1),
      [`dailyLastAt.${dateKey}`]: serverTimestamp(),
      lastLoggedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <div className="p-8 space-y-12 bg-zinc-50 min-h-screen">
      <header>
        <h1 className="text-4xl font-black text-zinc-900">How do you feel today?</h1>
        <p className="text-zinc-500 mt-2">Choose an emotion to log your current state.</p>
      </header>

      {/* Mood Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {emotions.map((emotion) => (
          <motion.button
            key={emotion.name}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleLogMood(emotion.name)}
            className={cn(
              "p-6 rounded-3xl border border-zinc-200 bg-white shadow-sm flex items-center justify-between transition-all",
              selectedMood === emotion.name && "ring-2 ring-sky-500"
            )}
          >
            <div>
              <h3 className="font-bold text-zinc-900">{emotion.name.toUpperCase()}</h3>
              <p className="text-sm text-zinc-500">Tap to log</p>
            </div>
            <div className={cn("w-4 h-4 rounded-full", emotion.color.replace('#', 'bg-'))} style={{ backgroundColor: emotion.color }} />
          </motion.button>
        ))}
      </div>

      {/* Interactive Bar Chart */}
      <section className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
        <h2 className="text-xl font-bold text-zinc-900 mb-6">Mood Frequency</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={moodData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip cursor={{fill: 'transparent'}} />
              <Bar dataKey="count" radius={[12, 12, 0, 0]}>
                {moodData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={emotions[index].color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Monthly Mood */}
      <MonthlyMoodChart />
    </div>
  );
}
