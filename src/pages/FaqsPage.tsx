import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Button, Container, PageHeader } from '../components/ui';
import { FaqItem } from '../types';

interface FaqsPageProps {
  onNavigate: (tab: string, param?: string) => void;
}

const CATEGORY_LABELS: Record<FaqItem['category'], string> = {
  membership: 'Membership',
  privacy: 'Privacy and your data',
  contributions: 'Getting involved',
  editorial: 'Articles and publishing',
  donations: 'Donations',
  general: 'General',
};

export const FaqsPage: React.FC<FaqsPageProps> = ({ onNavigate }) => {
  const { siteSettings } = useData();

  const groups = useMemo(() => {
    const published = (siteSettings.faqs || []).filter((f) => f.isPublished !== false);
    const order = Object.keys(CATEGORY_LABELS) as FaqItem['category'][];
    return order
      .map((cat) => ({ cat, items: published.filter((f) => f.category === cat) }))
      .filter((g) => g.items.length > 0);
  }, [siteSettings.faqs]);

  return (
    <>
      <PageHeader title="Questions" intro="Answers about membership, privacy, publishing and donations." />
      <section>
        <Container narrow className="py-16 sm:py-20">
          {groups.map((group) => (
            <div key={group.cat} className="mb-14 last:mb-0">
              <h2 className="mb-4 text-[1.625rem] font-semibold">{CATEGORY_LABELS[group.cat]}</h2>
              <div className="divide-y divide-line border-y border-line">
                {group.items.map((faq) => (
                  <details key={faq.id} className="group">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-[1.0625rem] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                      <span>{faq.question}</span>
                      <span aria-hidden="true" className="mt-0.5 shrink-0 text-[1.375rem] leading-none text-navy transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="max-w-[64ch] pb-6 text-[1.0313rem] leading-relaxed text-ink-soft">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-16 bg-stone p-8">
            <h2 className="text-[1.5rem] font-semibold">Still have a question?</h2>
            <p className="mt-2 text-ink-soft">Send us a message and a member of our team will reply.</p>
            <Button className="mt-6" onClick={() => onNavigate('contact')}>Contact us</Button>
          </div>
        </Container>
      </section>
    </>
  );
};
