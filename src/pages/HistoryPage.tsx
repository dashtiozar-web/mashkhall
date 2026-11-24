import React from 'react';
import { useData } from '../context/DataContext';
import { Button, Container, PageHeader } from '../components/ui';

interface HistoryPageProps {
  onNavigate: (tab: string, param?: string) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onNavigate }) => {
  const { siteSettings } = useData();
  const events = (siteSettings.history || []).filter((e) => e.isApproved !== false);

  return (
    <>
      <PageHeader
        title="Our history"
        intro="From the protests of February 2011 to an organisation with councils across the United Kingdom."
      />
      <section>
        <Container narrow className="py-16 sm:py-20">
          <ol className="relative border-s-2 border-line">
            {events.map((event, i) => (
              <li key={event.id} className="relative pb-14 ps-8 last:pb-0 sm:ps-12">
                <span
                  aria-hidden="true"
                  className={`absolute top-1.5 -start-[9px] h-4 w-4 rounded-full border-2 border-white ${
                    i === 0 ? 'bg-crimson' : 'bg-navy'
                  }`}
                />
                <p className="text-[0.9375rem] font-semibold text-navy">{event.date}</p>
                <h2 className="mt-1 text-[1.625rem] leading-snug font-semibold">{event.title}</h2>
                <p className="mt-3 max-w-[60ch] text-[1.0625rem] text-ink-soft">{event.description}</p>
                {event.sourceUrl && (
                  <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[0.9375rem] font-semibold text-navy underline">
                    Source
                  </a>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-16 flex flex-wrap gap-3 border-t border-line pt-10">
            <Button onClick={() => onNavigate('memorial')} variant="accent">17 Shubat 2011 Memorial</Button>
            <Button onClick={() => onNavigate('about')} variant="secondary">About the organisation</Button>
            <Button onClick={() => onNavigate('apply')}>Become a member</Button>
          </div>
        </Container>
      </section>
    </>
  );
};
