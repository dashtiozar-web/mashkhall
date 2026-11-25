import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Button, Container, PageHeader } from '../components/ui';
import { PublicationList } from '../components/PublicationList';
import { SECTIONS, sectionById, sectionOfCategory } from '../lib/sections';

interface Props { id?: string; onNavigate: (tab: string, param?: string) => void }

/** One section of the website: its published articles, newest first. */
export const SectionPage: React.FC<Props> = ({ id, onNavigate }) => {
  const { articles } = useData();
  const section = sectionById(id);
  const list = useMemo(
    () => (section ? articles.filter((a) => sectionOfCategory(a.category)?.id === section.id) : []),
    [articles, section],
  );
  if (!section) return <SectionsIndex onNavigate={onNavigate} />;
  return (
    <>
      <PageHeader title={section.group === 'news' ? `News: ${section.name}` : section.name} intro={section.description} />
      <Container className="py-12 sm:py-16">
        <PublicationList
          articles={list}
          onNavigate={onNavigate}
          emptyAction={<Button variant="secondary" onClick={() => onNavigate('contribute')}>Publish with us</Button>}
        />
      </Container>
    </>
  );
};

/** All sections, with how many articles each has. */
export const SectionsIndex: React.FC<{ onNavigate: (tab: string, param?: string) => void }> = ({ onNavigate }) => {
  const { articles } = useData();
  const count = (sid: string) => articles.filter((a) => a.status === 'published' && sectionOfCategory(a.category)?.id === sid).length;
  const Card: React.FC<{ s: (typeof SECTIONS)[number] }> = ({ s }) => (
    <li>
      <a href={`/sections/${s.id}`} onClick={(e) => { e.preventDefault(); onNavigate('section', s.id); }}
        className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 no-underline hover:border-ink/30 hover:shadow-[0_18px_40px_-28px_rgba(31,38,34,0.6)]">
        <span className="font-serif text-[1.5rem] font-semibold text-ink group-hover:underline">{s.name}</span>
        <span className="ku-sub w-fit font-kurdish text-[1.125rem] text-crimson" lang="ckb" dir="rtl" translate="no">{s.ku}</span>
        <span className="mt-2 text-ink-soft">{s.description}</span>
        <span className="mt-3 text-[0.875rem] text-muted">{count(s.id)} {count(s.id) === 1 ? 'article' : 'articles'}</span>
      </a>
    </li>
  );
  return (
    <>
      <PageHeader title="Sections" intro="News from Kurdistan, the Middle East and the world, and articles on politics, the economy, agriculture, the environment, health, culture and opinion." />
      <Container className="space-y-12 py-12 sm:py-16">
        <div>
          <h2 className="mb-5 text-[1.75rem] font-semibold">News</h2>
          <ul className="grid gap-5 sm:grid-cols-3">{SECTIONS.filter((s) => s.group === 'news').map((s) => <Card key={s.id} s={s} />)}</ul>
        </div>
        <div>
          <h2 className="mb-5 text-[1.75rem] font-semibold">Topics</h2>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{SECTIONS.filter((s) => s.group === 'topic').map((s) => <Card key={s.id} s={s} />)}</ul>
        </div>
      </Container>
    </>
  );
};
