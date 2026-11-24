import React from 'react';
import { useData } from '../context/DataContext';
import { Button, Container, PageHeader, SectionHeading, TextLink } from '../components/ui';

interface AboutPageProps {
  onNavigate: (tab: string, param?: string) => void;
}

const VALUES = [
  {
    title: 'Freedom of expression',
    description:
      'Everyone should be able to speak, write and report without intimidation, censorship or reprisal, including writers and journalists who criticise those in power.',
  },
  {
    title: 'Universal human rights',
    description:
      'Human dignity, due process and equality apply to every community, whatever their origin or belief.',
  },
  {
    title: 'Transparency',
    description:
      'Public institutions should be open about how they govern and how they spend public money. We campaign against secrecy and corruption.',
  },
  {
    title: 'Accountability',
    description:
      'Abuses of power should have consequences. We work to end impunity, whichever political or armed group is responsible.',
  },
  {
    title: 'Non-violence',
    description:
      'We act only through peaceful means: public events, lectures, research, publication and dialogue.',
  },
  {
    title: 'Community support',
    description:
      'We help members of the diaspora and their families with translation, mentoring, signposting and information about their rights.',
  },
];

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  const { siteSettings } = useData();
  const areas = siteSettings.areasOfWork || [];

  return (
    <>
      <PageHeader title="About Mashkhally Zhyanawa" intro={siteSettings.mission} />

      <section>
        <Container className="grid gap-14 py-16 sm:py-20 lg:grid-cols-[2fr_1fr] lg:gap-20">
          <div>
            <h2 className="text-[2rem] font-semibold">Why we exist</h2>
            <div className="prose-article mt-6 max-w-[62ch]">
              <p>
                On 17 February 2011, students, workers, writers and ordinary citizens gathered in Sara Square in
                Sulaymaniyah, and in towns across the Kurdistan Region, to ask for free media, transparent government,
                social equality and basic civil rights. The protests were peaceful.
              </p>
              <p>
                We do not want the principles of that movement to be forgotten or distorted. On 17 February 2015,
                members of the Kurdish community in the United Kingdom founded Mashkhally Zhyanawa as a lasting, structured
                organisation to keep that work going: documenting what happens, researching its causes, and supporting
                people who face injustice.
              </p>
              <p>
                Today we work through councils in cities across the UK. We are independent and are not affiliated with
                any government or political party.
              </p>
            </div>
            <TextLink className="mt-2" onClick={() => onNavigate('history')}>Read our history</TextLink>
          </div>

          <aside className="self-start border-t-2 border-crimson bg-stone p-7">
            <h2 className="font-sans text-[1rem] font-semibold">At a glance</h2>
            <dl className="mt-5 space-y-5 text-[0.9688rem]">
              <div>
                <dt className="text-muted">Founded</dt>
                <dd className="mt-0.5 font-serif text-[1.25rem] text-ink">17 February 2015</dd>
              </div>
              <div>
                <dt className="text-muted">Named after</dt>
                <dd className="mt-0.5 font-serif text-[1.25rem] text-ink">The protests of 17 February 2011</dd>
              </div>
              <div>
                <dt className="text-muted">Based in</dt>
                <dd className="mt-0.5 font-serif text-[1.25rem] text-ink">The United Kingdom</dd>
              </div>
              <div>
                <dt className="text-muted">Methods</dt>
                <dd className="mt-0.5 font-serif text-[1.25rem] text-ink">Peaceful and independent</dd>
              </div>
            </dl>
          </aside>
        </Container>
      </section>

      <section className="border-t border-line bg-stone">
        <Container className="py-16 sm:py-20">
          <SectionHeading
            title="What we stand for"
            intro="These principles guide what we publish, how we govern ourselves and how we work with communities."
          />
          <dl className="grid gap-x-12 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title}>
                <dt className="font-serif text-[1.375rem] font-semibold">{v.title}</dt>
                <dd className="mt-2 text-[1rem] text-ink-soft">{v.description}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {areas.length > 0 && (
        <section>
          <Container className="py-16 sm:py-20">
            <SectionHeading title="How we work" />
            <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
              {areas.map((area) => (
                <div key={area.id} className="border-t-2 border-navy pt-6">
                  <h3 className="text-[1.375rem] font-semibold">{area.title}</h3>
                  <p className="mt-2 max-w-[52ch] text-ink-soft">{area.description}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}

      <section className="border-t border-line">
        <Container className="flex flex-col gap-6 py-14 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[40ch] font-serif text-[1.625rem] leading-snug">
            Share these principles? Join us, or get in touch to work with us.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={() => onNavigate('apply')}>Become a member</Button>
            <Button size="lg" variant="secondary" onClick={() => onNavigate('contact')}>Contact us</Button>
          </div>
        </Container>
      </section>
    </>
  );
};
