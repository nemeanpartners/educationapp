import { UserProfile } from '../types';
import WorkbookPage from './WorkbookPage';

interface UniversityReportBuilderPageProps {
  profile: UserProfile | null;
}

export default function UniversityReportBuilderPage({ profile }: UniversityReportBuilderPageProps) {
  return <WorkbookPage profile={profile} variant="university-report" />;
}
