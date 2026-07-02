import { UserProfile } from '../types';
import { DashboardClient } from './DashboardClient';

interface DashboardProps {
  profile: UserProfile | null;
}

export default function Dashboard({ profile }: DashboardProps) {
  return <DashboardClient />;
}
