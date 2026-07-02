export interface TeacherClass {
  id: string;
  teacherId: string;
  subject: string;
  teacher: string;
  room: string;
  nextClass: string;
  colour: string;
}

export interface TeacherProfile {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  classes: TeacherClass[];
}

export const teacherClasses: TeacherClass[] = [];

export const teacherClassColours = [
  'border-cyan-200 bg-cyan-50 text-cyan-800',
  'border-indigo-200 bg-indigo-50 text-indigo-800',
  'border-amber-200 bg-amber-50 text-amber-800',
  'border-emerald-200 bg-emerald-50 text-emerald-800',
  'border-purple-200 bg-purple-50 text-purple-800',
  'border-rose-200 bg-rose-50 text-rose-800',
];

export const ticketTags = ['General question', 'Homework', 'Assignment', 'Exam', 'Feedback', 'Absence'];

export const teacherTicketStorageKey = 'teacher-tickets';
export const teacherProfilesStorageKey = 'teacher-profiles';

export type TeacherTicketStatus = 'open' | 'replied' | 'closed';

export interface TeacherTicketReply {
  message: string;
  teacherName: string;
  repliedAt: string;
  senderRole: 'student' | 'teacher';
  senderName: string;
}

export interface TeacherTicket {
  id: string;
  userId?: string;
  studentName: string;
  studentEmail: string;
  subject: string;
  message: string;
  tag: string;
  teacher: string;
  classSubject: string;
  sentAt: string;
  status: TeacherTicketStatus;
  replies: TeacherTicketReply[];
}

export function normalizeTeacherProfiles(docs: Array<{ id: string; data: any }>): TeacherProfile[] {
  return docs.map(({ id, data }) => {
    const teacherId = data.teacherId || id;
    const teacherName = data.teacherName || data.displayName || 'Teacher';
    const teacherEmail = data.teacherEmail || '';
    const classes = Array.isArray(data.classes)
      ? data.classes
        .map((classItem: any, index: number) => normalizeTeacherClass(classItem, teacherId, teacherName, index))
        .filter((classItem: TeacherClass) => classItem.subject.trim())
      : [];

    return {
      teacherId,
      teacherName,
      teacherEmail,
      classes,
    };
  });
}

export function flattenTeacherProfiles(profiles: TeacherProfile[]) {
  return profiles.flatMap((profile) => profile.classes);
}

export function normalizeTeacherClass(data: any, teacherId: string, teacherName: string, index: number): TeacherClass {
  return {
    id: data.id || `${teacherId}-${index}`,
    teacherId,
    subject: data.subject || '',
    teacher: data.teacher || teacherName || 'Teacher',
    room: data.room || '',
    nextClass: data.nextClass || '',
    colour: data.colour || teacherClassColours[index % teacherClassColours.length],
  };
}

export function readLocalTeacherProfiles() {
  try {
    const storedProfiles = JSON.parse(window.localStorage.getItem(teacherProfilesStorageKey) || '[]') as any[];
    return normalizeTeacherProfiles(storedProfiles.map((profile, index) => ({
      id: profile.teacherId || `local-teacher-${index}`,
      data: profile,
    })));
  } catch (error) {
    console.error('Could not read teacher profiles locally:', error);
    return [];
  }
}

export function writeLocalTeacherProfile(profile: TeacherProfile) {
  try {
    const currentProfiles = readLocalTeacherProfiles();
    const nextProfiles = currentProfiles.some((item) => item.teacherId === profile.teacherId)
      ? currentProfiles.map((item) => item.teacherId === profile.teacherId ? profile : item)
      : [profile, ...currentProfiles];
    window.localStorage.setItem(teacherProfilesStorageKey, JSON.stringify(nextProfiles));
  } catch (error) {
    console.error('Could not save teacher profile locally:', error);
  }
}

export function readLocalTeacherTickets() {
  try {
    const storedTickets = JSON.parse(window.localStorage.getItem(teacherTicketStorageKey) || '[]') as any[];
    return storedTickets.map((ticket) => normalizeTeacherTicket(ticket.id || `ticket-${Date.now()}`, ticket));
  } catch (error) {
    console.error('Could not read teacher tickets locally:', error);
    return [];
  }
}

export function writeLocalTeacherTickets(tickets: TeacherTicket[]) {
  try {
    window.localStorage.setItem(teacherTicketStorageKey, JSON.stringify(tickets));
  } catch (error) {
    console.error('Could not save teacher tickets locally:', error);
  }
}

export function normalizeTeacherTicket(id: string, data: any): TeacherTicket {
  return {
    id,
    userId: data.userId || '',
    studentName: data.studentName || 'Student',
    studentEmail: data.studentEmail || '',
    subject: data.subject || 'Untitled ticket',
    message: data.message || '',
    tag: data.tag || 'General question',
    teacher: data.teacher || 'Teacher',
    classSubject: data.classSubject || 'General',
    sentAt: typeof data.sentAt === 'string' ? data.sentAt : new Date().toISOString(),
    status: data.status || (Array.isArray(data.replies) && data.replies.length > 0 ? 'replied' : 'open'),
    replies: Array.isArray(data.replies)
      ? data.replies.map((reply: any) => ({
        message: reply.message || '',
        teacherName: reply.teacherName || reply.senderName || data.teacher || 'Teacher',
        repliedAt: typeof reply.repliedAt === 'string' ? reply.repliedAt : new Date().toISOString(),
        senderRole: reply.senderRole === 'student' ? 'student' : 'teacher',
        senderName: reply.senderName || reply.teacherName || data.teacher || 'Teacher',
      }))
      : [],
  };
}
