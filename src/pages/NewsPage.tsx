import React from 'react';
import { useData } from '../context/DataContext';
import { PublicationList } from '../components/PublicationList';
import { Button, Container, PageHeader } from '../components/ui';

interface NewsPageProps {
  onNavigate: (tab: string, param?: string) => void;
}

export const NewsPage: React.FC<NewsPageProps> = ({ onNavigate }) => {
  const { articles } = useData();
  return (
    <>
      <PageHeader
        title="News and reports"
        intro="Statements from the organisation, and research, reports and commentary from our members. Everything is reviewed by our editors before it is published."
      />
      <Container className="py-14 sm:py-16">
        <div className="mb-10 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-soft"><strong className="text-ink">Have a report, article or video?</strong> Members and visitors can send their work to our editors.</p>
          <Button onClick={() => onNavigate('contribute')}>Publish with us</Button>
        </div>
        <PublicationList
          articles={articles}
          onNavigate={onNavigate}
          emptyAction={<Button variant="secondary" onClick={() => onNavigate('contribute')}>Submit an article</Button>}
        />
      </Container>
    </>
  );
};
