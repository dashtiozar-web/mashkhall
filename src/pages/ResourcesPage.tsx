import React from 'react';
import { useData } from '../context/DataContext';
import { PublicationList } from '../components/PublicationList';
import { Container, PageHeader, TextLink } from '../components/ui';

interface ResourcesPageProps {
  onNavigate: (tab: string, param?: string) => void;
}

export const ResourcesPage: React.FC<ResourcesPageProps> = ({ onNavigate }) => {
  const { articles } = useData();
  return (
    <>
      <PageHeader
        title="Resources"
        intro="Our library of reports, research, recorded talks and archive material. Filter by type or topic, or search for a subject."
      />
      <Container className="py-14 sm:py-16">
        <PublicationList articles={articles} onNavigate={onNavigate} showTopics />
        <p className="mt-14 border-t border-line pt-8 text-ink-soft">
          Looking for help with a specific situation?{' '}
          <TextLink onClick={() => onNavigate('contact')}>Contact us</TextLink> and we will point you to the right
          support.
        </p>
      </Container>
    </>
  );
};
