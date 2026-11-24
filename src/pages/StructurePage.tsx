import React from 'react';
import { useData } from '../context/DataContext';
import { Button, Container, PageHeader } from '../components/ui';
import { OrgStructureChart } from '../components/OrgStructureChart';
import { useAssignments } from '../lib/orgStructure';
import { useNewsBanners } from '../lib/newsBanner';
import { useMemberCount } from '../components/MemberCount';

interface StructurePageProps {
  onNavigate: (tab: string, param?: string) => void;
}

/** The public organisation chart, drawn from live appointments. */
export const StructurePage: React.FC<StructurePageProps> = ({ onNavigate }) => {
  const { chapters } = useData();
  const assignments = useAssignments();
  const { banners } = useNewsBanners(false);
  const { total, profiles } = useMemberCount();

  return (
    <>
      <PageHeader
        title="Our structure"
        intro="How 17 Shubat Organization for Human Rights is organised: the Board of Directors, six councils with their own teams, and an organisation-wide Production Team."
      />
      <Container className="py-12 sm:py-16">
        {assignments === null ? (
          <p className="py-16 text-center text-muted">Loading the organisation chart…</p>
        ) : (
          <OrgStructureChart assignments={assignments} profiles={profiles} councils={chapters} activities={banners} />
        )}
        <div className="mt-16 rounded-2xl border border-line bg-surface p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <p className="text-ink-soft">
            <strong className="text-ink">{total.toLocaleString('en-GB')} approved members</strong> belong to 17 Shubat. Positions marked “Vacant” are not currently held.
          </p>
          <div className="mt-4 flex shrink-0 flex-wrap gap-3 sm:mt-0">
            <Button variant="secondary" onClick={() => onNavigate('directory')}>Councils and people</Button>
            <Button onClick={() => onNavigate('apply')}>Become a member</Button>
          </div>
        </div>
      </Container>
    </>
  );
};
