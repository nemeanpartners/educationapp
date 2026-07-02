export interface HomeworkSession {
  subject: string;
  technique: string;
  duration: string;
  timeOfDay: string;
  day: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_OF_DAY_FALLBACK: Record<string, string> = {
  morning: '08:00',
  afternoon: '15:00',
  evening: '19:00',
  'late night': '22:00',
  night: '22:00',
};

function normalizeDay(input: string | undefined, index: number) {
  if (!input) return DAYS[index % DAYS.length];
  const trimmed = input.trim();
  const match = DAYS.find(d => d.toLowerCase() === trimmed.toLowerCase());
  return match ?? DAYS[index % DAYS.length];
}

function normalizeTime(input: string | undefined, index: number) {
  if (!input) return `${(8 + (index % 9)).toString().padStart(2, '0')}:00`;
  const lower = input.trim().toLowerCase();
  if (TIME_OF_DAY_FALLBACK[lower]) return TIME_OF_DAY_FALLBACK[lower];

  const timeMatch = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3];
    if (meridiem) {
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
    }
    hour = Math.min(23, Math.max(0, hour));
    const mm = Math.min(59, Math.max(0, minutes));
    return `${hour.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  }

  return `${(8 + (index % 9)).toString().padStart(2, '0')}:00`;
}

export function normalizePlan(sessions: HomeworkSession[]) {
  return sessions.map((s, index) => ({
    ...s,
    day: normalizeDay(s.day, index),
    timeOfDay: normalizeTime(s.timeOfDay, index),
  }));
}

export function isValidSession(s: HomeworkSession) {
  return Boolean(s.subject && s.day && s.timeOfDay);
}
