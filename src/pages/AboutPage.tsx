import React from 'react';
import { Button, Container, PageHeader, SectionHeading } from '../components/ui';

interface AboutPageProps {
  onNavigate: (tab: string, param?: string) => void;
}

/** What Mashkhally Zhyanawa is: the organisation's own definition, arranged from its manifesto. */
export const MZ_DEFINITION =
  `Mashkhally Zhyanawa is a roadmap for restoring trust and self-confidence to the members of our society, through self-education and self-organisation in a new political movement that brings people back to honest and legitimate politics and governance, for the happiness and wellbeing of our people, relying on the people’s own inexhaustible strength.`;

const ROOTS = [
  { title: 'The failure of the elite', text: `The failings of Kurdish elites and rulers in every era.` },
  { title: 'The role of our enemies', text: `Before they occupy our land, our enemies occupy our minds, importing ready-made interpretations, often in the name of religion, to weaken the reason, awareness and will of the Kurdish people.` },
  { title: 'The low level of public awareness', text: `Without awareness, people cannot recognise the causes of their suffering or the way out of it.` },
];

const PRINCIPLES = [
  { title: 'Dignity', text: `Dignity and the spirit together give meaning to being human. To strip a person of dignity is like killing them. Oppression, injustice, indifference and the acceptance of oppression produce people without dignity.` },
  { title: 'Awareness and self-education', text: `Change begins with ourselves. A Kurd who educates themselves on this method becomes an example to others.` },
  { title: 'Politics for the people', text: `Those in power make politics look ugly to keep people away from public life. We want to reconcile people with politics and with working for the common good.` },
  { title: 'Organised collective work', text: `Directed, organised and collective work, built on the science of organisation, is the way to the common good, weaving together the people’s strength.` },
  { title: 'Unity', text: `We want to bring together the strength and concerns of the people of Duhok, Erbil, Sulaymaniyah and every other city, and of every group and person who wants change.` },
  { title: 'Openness', text: `We have no hidden side. Our programme is open and public, and we do not believe in deception.` },
];

const QUESTIONS = [
  `Why is our people’s suffering so deep, and where does it come from?`,
  `Why were no good parties built in the past, why do the new ones turn bad, and why are parties run by families?`,
  `Why is there bad government, and no brave and clean opposition?`,
  `Why do protests and elections bear no fruit?`,
  `How do false activists, intellectuals and clerics find their way among us, and how have faith, tribes and religious movements been poisoned?`,
  `Why are six million people held captive by a few hundred corrupt and oppressive people?`,
  `How dangerous is the economic system in place, and what kind of economy is good?`,
  `Why do the discontented not unite, and how can we work together?`,
  `How is a strong movement built, and how can it avoid becoming bad like the others?`,
  `How can we face those in power successfully and solve the problems of our people and country?`,
  `What is the role of women, young people and the Kurdish diaspora?`,
];

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => (
  <>
    <PageHeader title="About Mashkhally Zhyanawa" intro={MZ_DEFINITION} />

    {/* The book and the manifesto */}
    <section>
      <Container className="grid gap-14 py-16 sm:py-20 lg:grid-cols-[2fr_1fr] lg:gap-20">
        <div>
          <h2 className="text-[2rem] font-semibold">The book and the manifesto</h2>
          <div className="prose-article mt-6 max-w-[62ch]">
            <p>Mashkhally Zhyanawa began as a book and a manifesto. In nineteen chapters it examines, carefully and responsibly, the social, political, religious, governmental and party structures of Kurdish society, identifies the causes of our people’s decline, and sets out solutions for them.</p>
            <p>Its subjects are researched and grounded in science, yet it is written to be read with interest. Its views are balanced, educational and methodical, hostile to no one, and written only to serve people. Like the books history has called the gospels of change, it does not stop at describing the problems of our world: it calls for changing it.</p>
            <p>It is a project for the future. Every Kurd must answer for themselves: will I serve my homeland, and begin reforming myself, my family, my neighbourhood and my city? Or will I wait for others to bring change, and believe change is impossible? Every teacher and educator should read it, discuss it with their students and encourage them to serve their homeland.</p>
          </div>
        </div>
        <aside className="self-start border-t-2 border-crimson bg-stone p-7">
          <img src="/brand/torch-still.webp" alt="" className="mx-auto h-48 w-auto" />
          <p className="mt-4 text-center font-serif text-[1.5rem] font-semibold text-ink" translate="no">Mashkhally Zhyanawa</p>
          <p className="mt-1 text-center font-kurdish text-[1.375rem] text-crimson" lang="ckb" dir="rtl" translate="no">مەشخەڵی ژیانەوە</p>
          <p className="ku-sub mt-4 text-center text-[0.9688rem] text-ink-soft">The Torch of Revival</p>
        </aside>
      </Container>
    </section>

    {/* The roots of our problems */}
    <section className="border-t border-line bg-stone">
      <Container className="py-16 sm:py-20">
        <SectionHeading title="The roots of our problems" intro="The manifesto traces our problems to three main causes." />
        <ol className="grid gap-8 md:grid-cols-3">
          {ROOTS.map((r, i) => (
            <li key={r.title} className="border-t-2 border-navy pt-6">
              <p className="font-serif text-[2.25rem] leading-none text-crimson">{i + 1}</p>
              <h3 className="mt-3 text-[1.375rem] font-semibold">{r.title}</h3>
              <p className="mt-2 text-ink-soft">{r.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>

    {/* Principles */}
    <section>
      <Container className="py-16 sm:py-20">
        <SectionHeading title="What we stand for" intro="The principles of the manifesto guide everything we do." />
        <dl className="grid gap-x-12 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map((v) => (
            <div key={v.title}>
              <dt className="font-serif text-[1.375rem] font-semibold">{v.title}</dt>
              <dd className="mt-2 text-[1rem] text-ink-soft">{v.text}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>

    {/* Quotation from the manifesto */}
    <section className="bg-[#1F100B] text-white">
      <Container narrow className="py-16 sm:py-20">
        <h2 className="font-sans text-[0.875rem] font-semibold tracking-[0.12em] text-[#F2C14E] uppercase">From the manifesto</h2>
        <blockquote className="mt-6 border-s-4 border-[#F2C14E] ps-6 font-serif text-[1.25rem] leading-relaxed text-white/90 sm:text-[1.375rem]">
          The German philosopher Nietzsche said: “In the whole destiny of mankind there is no harsher misfortune than when the powerful of the earth are not also the first and best among people. Then everything becomes false, crooked and monstrous.” The rulers of our Region have been exactly that misfortune for our people: false freedom, democracy and human rights; false parties and civil society; false justice, courts, elections and parliament; false patriotism; false leaders and heroes; promise after promise of false reform. The result is despair, falsehood and fear.
        </blockquote>
      </Container>
    </section>

    {/* The questions it answers */}
    <section className="border-b border-line bg-stone">
      <Container className="py-16 sm:py-20">
        <SectionHeading title="The questions it answers" intro="The manifesto answers questions like these, through politics, economics, history, psychology and sociology, and through story, literature and thought." />
        <ul className="grid gap-x-12 gap-y-4 md:grid-cols-2">
          {QUESTIONS.map((q) => (
            <li key={q} className="flex gap-3 text-[1.0313rem] text-ink">
              <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-ember" aria-hidden="true" />
              <span>{q}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>

    {/* Unity */}
    <section>
      <Container className="grid gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-20">
        <div>
          <h2 className="text-[2rem] font-semibold">Unity before a new party</h2>
          <div className="prose-article mt-6 max-w-[62ch]">
            <p>We have not founded a new political party. We have called for unity and joint work between all opposition forces, groups and figures, and have met Yekgirtu, Gorran, Komal and Halwest and spoken with many others. The responses have been encouraging, and the work continues.</p>
            <p>In this sensitive moment, bringing the discontented together is harder, and more needed, than founding another party. Alongside it, the manifesto, built on the science of organisation and conscious education, can grow into a strong and lasting movement. We work for it in the Kurdistan Region, the United States, Britain and Europe.</p>
            <p>Reconciliation starts with ourselves: for this historic stage, we set aside our own disagreements with other people and groups, because peace and unity cannot come unless they take root in our hearts first.</p>
          </div>
        </div>
        <div className="self-start rounded-3xl border border-line bg-surface p-8">
          <h2 className="text-[2rem] font-semibold">Two roads</h2>
          <p className="mt-5 text-[1.0938rem] leading-relaxed text-ink-soft">We have two roads before us: to accept despair, pessimism, oppression and injustice and give up on politics; or for citizens to carry the torch of hope and revival, take the tool of politics back into their own hands, and take an active part in decisions and change.</p>
          <p className="mt-5 font-serif text-[1.375rem] leading-snug text-ink">Mashkhally Zhyanawa is the hope of rising again: a plan for a bright future.</p>
          <p className="mt-4 font-semibold text-crimson">Read the book Mashkhally Zhyanawa, and carry the torch with us.</p>
        </div>
      </Container>
    </section>

    <section className="border-t border-line">
      <Container className="flex flex-col gap-6 py-14 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-serif text-[1.625rem] leading-snug">Carry the torch with us</p>
          <p className="mt-1 text-ink-soft">Join Mashkhally Zhyanawa, or get in touch to work with us.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={() => onNavigate('apply')}>Become a member</Button>
          <Button size="lg" variant="secondary" onClick={() => onNavigate('contact')}>Contact us</Button>
        </div>
      </Container>
    </section>
  </>
);
