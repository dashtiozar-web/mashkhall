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

const BOOK_THEMES = [
  { title: "Reading the situation: rule that behaves like occupation", text: "After the uprising, the book argues, those in power ruled with the mindset of occupiers and forgers instead of building national and democratic institutions. They have led the environment, the economy and society towards dependence and despair, producing a silenced, submissive individual and a culture of loss." },
  { title: "Self-sickness, tribalism and hidden servitude", text: "The Kurdish problem is not only a matter of enemies outside. It is also bound up with what the author calls self-sickness: staying inside the mindset of the tribe, in a servitude of mind and spirit. Defeat has been repeated so often in history and literature that it has come to look like fate." },
  { title: "Neoliberalism and “super-neoliberalism”", text: "Neoliberalism turns the basic rights to life, health and education into goods for sale, breaks society down to isolated individuals, takes the tools of politics away from people through money and companies, and numbs them with sport, art, sex and social media. In the Kurdistan Region it has merged with tribalism and kleptocracy into what the book calls super-neoliberalism, which produces a false consciousness." },
  { title: "Self-knowledge, dignity and the politics of self-healing", text: "Liberation begins with self-knowledge and with owning oneself, rather than losing oneself in blind imitation, and dignity is guarded as the condition of being human and of resisting. From there the book sets out the politics of self-healing: society taking part directly in government and actively watching over it, so that politics comes back to life from below as an industry of the common good." },
  { title: "Social media and a new horizon", text: "The book warns that online activity and careless likes cannot take the place of the street, organising on the ground and work in the field. It closes by stressing commitment to the manifesto and the roadmap, with the example of McDonald’s operating manual as Alain de Botton describes it, and names an organised movement, an economy of revival, and the protection of dignity and freedom as a new beginning." },
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
          <p className="mt-5 border-t border-line pt-4 text-center text-[0.8125rem] font-semibold tracking-[0.08em] text-muted uppercase">Our motto</p>
          <p className="mt-1.5 text-center font-serif text-[1.25rem] font-semibold leading-snug text-crimson">Good character, good movement, good governance</p>
        </aside>
      </Container>
    </section>

    {/* The book: its author, aim and method */}
    <section className="border-t border-line">
      <Container className="py-16 sm:py-20">
        <div className="max-w-[62ch]">
          <h2 className="text-[2rem] font-semibold">About the book</h2>
          <div className="prose-article mt-6">
            <p>The book Mashkhally Zhyanawa, written and published in 2025 by Abdullah Mala Nuri, is an intellectual, political and social text that offers, in a critical and educational way, a deep reading of the reality of society and of the system of government in the Kurdistan Region. It does not stop at describing the crises: it identifies the structural and internal sources of Kurdish fragmentation and weakness, and sets out a roadmap the author calls “self-healing” and “the politics of self-healing”: returning will, awareness and responsibility to the individual and to society itself, instead of waiting in vain for a solution from outside or repeating old tactics that lead nowhere.</p>
          </div>
          <h3 className="mt-10 text-[1.5rem] font-semibold">Method and outlook</h3>
          <div className="prose-article mt-4">
            <p>A distinctive feature of the book is that it uses Kurdish myth and heritage, above all the legend of the furnaces of Bawa Amra in southern Kurdistan and the land between the two rivers, as a heuristic and analytical tool for understanding the nature of tyranny and fragmentation and the ways to confront them. In the legend, a ghost-like dragon lives in the furnaces, ruining people’s lives and safety and drawing different responses, from flight and surrender to resistance, until Bawa Hora, Khanzada Khan and Dala unite wisdom and strength and found the system of the “Great Klura”, built on shared citizenship and on uniting wisdom, wealth and the sword. Together they destroy the dragon and lead society from tribalism to a shared order. The book reads this legend against fatalism: defeat is not the inevitable fate of the Kurds, and the power to change lies within.</p>
            <p>On the theoretical side, the author brings the Kurds’ own history into conversation with the ideas of thinkers from Kurdistan and the wider world. The years after the 1991 uprising, the civil war, the salary crisis, and the words of the martyr Aram on the collapse of 1975 and the Algiers Agreement are read alongside Friedrich Nietzsche, Immanuel Kant, John Stuart Mill, Jean Baudrillard, Jacques Lacan, Marcus Aurelius, Ibn Khaldun, Machiavelli, Hannah Arendt, Václav Havel, Martin van Bruinessen, Jonathan Brown, Abbas Vali and Masud Muhammad.</p>
          </div>
        </div>

        <div className="mt-14">
          <h3 className="text-[1.5rem] font-semibold">The book’s main themes</h3>
          <p className="mt-2 max-w-[62ch] text-[1.0625rem] text-ink-soft">The book’s thinking rests on a chain of connected questions.</p>
          <ol className="mt-8 grid gap-6 md:grid-cols-2">
            {BOOK_THEMES.map((t, i) => (
              <li key={t.title} className="rounded-2xl border border-line bg-surface p-6">
                <span className="font-serif text-[1.5rem] font-semibold text-crimson" translate="no">{i + 1}</span>
                <h4 className="mt-1 text-[1.1875rem] font-semibold">{t.title}</h4>
                <p className="mt-2 text-[1rem] leading-relaxed text-ink-soft">{t.text}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-14 max-w-[62ch] border-s-4 border-crimson ps-6">
          <h3 className="text-[1.5rem] font-semibold">Why the book matters to the reader</h3>
          <p className="mt-3 text-[1.125rem] leading-relaxed">Mashkhally Zhyanawa is a manifesto and an intellectual and political roadmap. Its main aim is to turn the reader from an indifferent onlooker, or an empty-handed victim of the situation, into an aware and responsible person who holds on to their dignity: someone who changes their own thinking, ethics and conscience at the root before waiting for change from outside, and who moves, through shared and organised work, towards a lasting revival.</p>
        </div>
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
