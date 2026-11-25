import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button, Container } from '../components/ui';

/**
 * In memory of Rebin Shamamki (1965–2026). Every statement is followed by
 * the number of the source it comes from; the sources are listed below.
 */

interface Source { n: number; publisher: string; title: string; date?: string; url: string; lang: string }

const SOURCES: Source[] = [
  { n: 1, publisher: 'KNN', title: 'ڕێبین شەمامکی، پارێزەر و چالاکوانی ناسراوی شاری هەولێر کۆچی دوایی کرد', date: '29 September 2026', url: 'https://www.knnc.net/Details.aspx?jimare=67585', lang: 'ckb' },
  { n: 2, publisher: 'Facebook', title: 'Facebook post about his death', url: 'https://www.facebook.com/share/1CUyhLNidE/', lang: 'ckb' },
  { n: 3, publisher: 'YouTube', title: 'ڕێبین شەمامکی؛ پێشمەرگەی دێرین، پارێزەری مافخوراوان و نووسەری بەهەڵوێست ١٩٦٥', url: 'https://www.youtube.com/watch?v=h7GDvaAEtEM', lang: 'ckb' },
  { n: 4, publisher: 'Hathalyoum', title: 'The same KNN report, republished', url: 'https://krd.hathalyoum.net/articles/1116108', lang: 'ckb' },
  { n: 5, publisher: 'Community Peacemaker Teams – Iraqi Kurdistan', title: 'Volunteer lawyers in the Badinan detainees’ case', date: '12 February 2019', url: 'https://cptik.org/kurdish/2019/2/12/-', lang: 'ckb' },
  { n: 6, publisher: 'Zamen Press', title: 'His interview with Safin Mala Qara on the Battle of Kore', date: '12 April 2022', url: 'https://www.zamenpress.com/Details.aspx?jimare=56930', lang: 'ckb' },
  { n: 7, publisher: 'Regay Kurdistan', title: 'Call to identify the attackers of Shwan Sabir (signatory no. 37)', url: 'https://regaykurdistan.com/index.php/hewal/kwrdstany/r-zhnamhnwwsan-w-chalakwanan-daway-yashkrakrdny-h-rshbhrany-shr-shwan-sabyr-dhkhn', lang: 'ckb' },
];

const LIFE: { text: string; refs: number[] }[] = [
  { text: 'Born in 1965 in the village of Shamamar, in the Shamamk plain of Erbil.', refs: [1] },
  { text: 'Completed secondary school in 1983 and was admitted to an institute in Kirkuk, but in 1984 he was barred from studying for refusing to take part in the summer training of the Popular Army.', refs: [1] },
  { text: 'Joined the Peshmerga in 1986 and stayed in the mountains until 1989. With the 1991 uprising he returned to the Peshmerga and served until 1992.', refs: [1] },
  { text: 'Graduated in law from the University of Mosul, and earned a master’s degree in international law in Tehran.', refs: [1] },
  { text: 'As a lawyer and activist, he defended citizens’ rights and, within the Gorran Movement, worked for fundamental reform, justice, freedoms and the rights of all groups.', refs: [1] },
  { text: 'He was one of the volunteer lawyers who followed the case of the detainees of Badinan.', refs: [5] },
  { text: 'As a lawyer, he signed the call by journalists and activists to identify those who attacked Shwan Sabir.', refs: [7] },
  { text: 'He also wrote history: he interviewed Safin Mala Qara, one of the field commanders of the Battle of Kore, and was writing his own memoirs, which remained unfinished and unpublished.', refs: [6, 1] },
];

const Refs: React.FC<{ refs: number[] }> = ({ refs }) => (
  <sup className="ms-1 whitespace-nowrap text-[0.75rem] font-semibold">
    {refs.map((r, i) => (
      <React.Fragment key={r}>{i > 0 && ', '}<a href={`#source-${r}`} className="text-crimson no-underline hover:underline" aria-label={`Source ${r}`}>[{r}]</a></React.Fragment>
    ))}
  </sup>
);

export const RebinShamamkiPage: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  return (
    <>
      <header className="bg-[#1F100B] text-white">
        <Container className="grid gap-10 py-12 sm:py-16 md:grid-cols-[minmax(0,280px)_1fr] md:items-center">
          <figure className="mx-auto w-full max-w-[280px]">
            <img src="/images/rebin-shamamki.jpg" alt="Rebin Shamamki" width={420} height={476} className="w-full rounded-2xl object-cover shadow-[0_24px_50px_-24px_rgba(0,0,0,0.8)] ring-1 ring-white/15" />
            <figcaption className="mt-2 text-center text-[0.75rem] text-white/55">Photograph supplied to Mashkhally Zhyanawa</figcaption>
          </figure>
          <div>
            <p className="text-[0.875rem] font-semibold tracking-[0.12em] text-[#F2C14E] uppercase">In memory</p>
            <h1 className="mt-2 text-[2.5rem] leading-tight font-semibold text-white sm:text-[3.25rem]">Rebin Shamamki</h1>
            <p className="ku-sub mt-1 w-fit font-kurdish text-[1.75rem] text-[#F2C14E]" lang="ckb" dir="rtl" translate="no">ڕێبین شەمامکی</p>
            <p className="mt-2 text-[1.125rem] text-white/80">1965 – 2026</p>
            <p className="mt-5 font-serif text-[1.375rem] leading-snug text-white/95">Veteran Peshmerga, lawyer for the wronged, and committed writer</p>
            <p className="mt-5 max-w-[60ch] text-[1.0625rem] leading-relaxed text-white/85">
              Rebin Shamamki, a veteran Peshmerga and well-known lawyer and activist from Erbil, died on Tuesday, 29 September 2026, after health problems. He spent his life defending the rights of citizens.
              <Refs refs={[1, 2, 3]} />
            </p>
            <dl className="mt-6 grid max-w-md grid-cols-2 gap-4 text-[0.9375rem]">
              <div><dt className="text-white/60">Born</dt><dd className="font-semibold"><span>1965</span> · <span>Shamamar village, Erbil</span></dd></div>
              <div><dt className="text-white/60">Died</dt><dd className="font-semibold">29 September 2026</dd></div>
            </dl>
          </div>
        </Container>
      </header>

      <section>
        <Container narrow className="py-14 sm:py-16">
          <h2 className="text-[1.875rem] font-semibold">His life</h2>
          <ol className="mt-6 space-y-5 border-s-2 border-line ps-6">
            {LIFE.map((item) => (
              <li key={item.text} className="relative text-[1.0625rem] leading-relaxed text-ink">
                <span className="absolute top-2.5 -start-[31px] h-3 w-3 rounded-full bg-crimson" aria-hidden="true" />
                {item.text}<Refs refs={item.refs} />
              </li>
            ))}
          </ol>
          <p className="mt-10 border-t border-line pt-8 font-serif text-[1.25rem] leading-snug text-ink">
            We remember him with respect, and share our condolences with his family, his friends and all who knew him.
          </p>
        </Container>
      </section>

      <section className="border-t border-line bg-stone">
        <Container narrow className="py-14 sm:py-16">
          <h2 className="text-[1.875rem] font-semibold">Sources</h2>
          <p className="mt-2 text-ink-soft">The numbers in the text refer to these sources.</p>
          <ol className="mt-6 space-y-4">
            {SOURCES.map((s) => (
              <li key={s.n} id={`source-${s.n}`} className="scroll-mt-28 rounded-xl border border-line bg-surface p-4">
                <p className="text-[0.875rem] font-semibold text-muted">[{s.n}] <span>{s.publisher}</span>{s.date && <> · <span>{s.date}</span></>}</p>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-start gap-1.5 font-semibold text-navy underline-offset-2 hover:underline">
                  <span dir="auto" lang={/[؀-ۿ]/.test(s.title) ? s.lang : undefined} translate={/[؀-ۿ]/.test(s.title) ? 'no' : undefined}>{s.title}</span>
                  <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ol>
          <div className="mt-10"><Button variant="secondary" onClick={() => onNavigate('home')}>Home</Button></div>
        </Container>
      </section>
    </>
  );
};
