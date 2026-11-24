import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Flame, Search } from 'lucide-react';
import { Container, LOGO_URL } from '../components/ui';
import { MemorialSlideshow, SlideshowLabels } from '../components/MemorialSlideshow';
import {
  Bi, DEDICATION, MARTYRS_TITLE, MEMORIAL_INTRO, MEMORIAL_INTRO_SOURCES, MEMORIAL_SUBTITLE, MEMORIAL_TITLE,
  MemorialEvent, MemorialPerson, memorialDate, MONTHS, POSTER_PORTRAITS, TIMELINE_PENDING, TOTALS,
} from '../data/memorial';
import { claimText, MergedMemorial, NoteData, searchText, useMemorial } from '../lib/memorial';
import { videoEmbed } from '../lib/video';
import { getLang, useLang } from '../i18n/lang';

/**
 * 17 Shubat 2011 memorial: the demonstrations that began in Sulaimani on
 * 17 February 2011, the days that followed, and the people who were killed.
 *
 * The memorial's own text is shown in Kurdish (Sorani) or English, chosen
 * here (independently of the interface language), and is never passed
 * through the interface translator. Every statement shows its source;
 * disagreements between sources are shown, not resolved.
 */

type CL = 'en' | 'ckb';

const T = {
  en: {
    nav: 'On this page', slideshow: 'The days, in order', timeline: 'Timeline', martyrs: 'Martyrs', archive: 'Photographs and video', sources: 'Sources',
    language: 'Language of the memorial', search: 'Search the record', searchPh: 'A name, a place or a date', allMonths: 'All months',
    noMatch: 'No entry matches your search.', source: 'Source', sourcesLabel: 'Sources', verify: 'To be verified', correction: 'Correction',
    evidence: 'Further evidence', translation: 'Translation', spelling: 'Spelling', verified: 'verified', addedOn: 'added', people: 'Named in this entry',
    age: 'Age', ageReported: 'Age as reported', shot: 'Shot or injured', died: 'Died', place: 'Place', circumstances: 'What the sources record',
    spellings: 'Spellings in the sources', status: { documented: 'Named in a published account of the events', listed: 'Listed by the organisation; awaiting confirmation from a published source' },
    noArchive: 'Photographs, documents and video will be added here once permission to publish them has been confirmed. We do not show graphic images.',
    original: 'Original Kurdish text', englishT: 'English translation', pending: 'Full text to be added', open: 'Open the source', credit: 'Credit',
    transcript: 'Transcript', totals: 'Totals', intro: 'About these days',
    slides: { previous: 'Previous', next: 'Next', pause: 'Pause', play: 'Play', slide: (n: number, t: number) => `Slide ${n} of ${t}`, region: 'Slideshow' },
    martyrSlides: 'Remembering the martyrs, one by one', time: 'Time', reducedNote: 'The slideshow moves slowly. Use the buttons to pause it or to go back and forward.',
  },
  ckb: {
    nav: 'لەم پەڕەیەدا', slideshow: 'ڕۆژەکان، بە ڕیز', timeline: 'ڕیزبەندیی ڕووداوەکان', martyrs: 'شەهیدان', archive: 'وێنە و ڤیدیۆ', sources: 'سەرچاوەکان',
    language: 'زمانی یادگارەکە', search: 'گەڕان لە تۆمارەکەدا', searchPh: 'ناوێک، شوێنێک یان بەروارێک', allMonths: 'هەموو مانگەکان',
    noMatch: 'هیچ تۆمارێک لەگەڵ گەڕانەکەت ناگونجێت.', source: 'سەرچاوە', sourcesLabel: 'سەرچاوەکان', verify: 'پێویستی بە پشتڕاستکردنەوەیە', correction: 'ڕاستکردنەوە',
    evidence: 'بەڵگەی زیاتر', translation: 'وەرگێڕان', spelling: 'ڕێنووس', verified: 'پشتڕاستکراوە', addedOn: 'زیادکراوە', people: 'ناوهاتووان لەم تۆمارەدا',
    age: 'تەمەن', ageReported: 'تەمەن وەک ڕاپۆرتکراوە', shot: 'پێکران یان برینداربوون', died: 'گیانلەدەستدان', place: 'شوێن', circumstances: 'ئەوەی سەرچاوەکان تۆماریان کردووە',
    spellings: 'ڕێنووسەکانی ناو لە سەرچاوەکاندا', status: { documented: 'لە گێڕانەوەیەکی بڵاوکراوەی ڕووداوەکاندا ناوی هاتووە', listed: 'ڕێکخراوەکە ناوی هێناوە؛ چاوەڕێی پشتڕاستکردنەوە لە سەرچاوەیەکی بڵاوکراوە' },
    noArchive: 'وێنە، بەڵگەنامە و ڤیدیۆ لێرە زیاد دەکرێن کاتێک مۆڵەتی بڵاوکردنەوەیان پشتڕاست کرایەوە. وێنەی دڵتەزێن پیشان نادەین.',
    original: 'دەقی ڕەسەنی کوردی', englishT: 'وەرگێڕانی ئینگلیزی', pending: 'دەقی تەواو زیاد دەکرێت', open: 'کردنەوەی سەرچاوە', credit: 'مافی وێنە',
    transcript: 'دەقی نووسراو', totals: 'کۆی گشتی', intro: 'دەربارەی ئەو ڕۆژانە',
    slides: { previous: 'پێشوو', next: 'داهاتوو', pause: 'ڕاگرتن', play: 'لێدان', slide: (n: number, t: number) => `سلایدی ${n} لە ${t}`, region: 'پیشاندانی سلاید' },
    martyrSlides: 'یادکردنەوەی شەهیدان، یەک بە یەک', time: 'کات', reducedNote: 'پیشاندانەکە هێواش دەجووڵێت. دوگمەکان بەکاربهێنە بۆ ڕاگرتن یان چوونە پێش و دواوە.',
  },
} as const;

const NOTE_LABEL = (cl: CL, t: NoteData['noteType']) => T[cl][t];

const prefLang = (): CL => {
  try {
    const saved = localStorage.getItem('17shubat_memorial_lang');
    if (saved === 'en' || saved === 'ckb') return saved;
  } catch { /* storage blocked */ }
  return getLang() === 'ckb' ? 'ckb' : 'en';
};

const SourceRef: React.FC<{ id: string; m: MergedMemorial; cl: CL }> = ({ id, m, cl }) => {
  const s = m.sources.find((x) => x.id === id);
  if (!s) return null;
  return (
    <a href={`#source-${s.id}`} className="underline decoration-white/30 underline-offset-4 hover:decoration-white">
      <bdi dir="ltr">{s.publisher.split(' (')[0]}{s.date ? `, ${s.date.slice(0, 4)}` : ''}</bdi>
    </a>
  );
};

const SourceList: React.FC<{ ids: string[]; m: MergedMemorial; cl: CL; light?: boolean; citations?: { title: string; url?: string }[] }> = ({ ids, m, cl, light, citations }) => {
  const known = ids.filter((id) => id !== 'citation');
  const all = [...known.map((id) => <SourceRef key={id} id={id} m={m} cl={cl} />),
    ...(citations || []).map((c, i) => c.url ? <a key={`c${i}`} href={c.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{c.title}</a> : <span key={`c${i}`}>{c.title}</span>)];
  return (
    <p className={`text-[0.875rem] ${light ? 'text-muted' : 'text-white/65'}`}>
      <span className="font-semibold">{all.length > 1 ? T[cl].sourcesLabel : T[cl].source}:</span>{' '}
      {all.map((node, n) => <React.Fragment key={n}>{n > 0 && ' · '}{node}</React.Fragment>)}
    </p>
  );
};

const Flags: React.FC<{ flags?: Bi[]; cl: CL }> = ({ flags, cl }) =>
  flags?.length ? (
    <div className="mt-3 rounded-md border border-amber/40 bg-amber/10 p-3 text-[0.9063rem]">
      <p className="flex items-center gap-1.5 font-semibold text-[#F0C779]"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> {T[cl].verify}</p>
      <ul className="mt-1 list-disc space-y-0.5 ps-5 text-white/85">{flags.map((f, i) => <li key={i}>{f[cl]}</li>)}</ul>
    </div>
  ) : null;

const Notes: React.FC<{ id: string; m: MergedMemorial; cl: CL }> = ({ id, m, cl }) => {
  const list = m.notes[id];
  if (!list?.length) return null;
  return (
    <ul className="mt-3 space-y-2">
      {list.map((n, i) => (
        <li key={i} className="rounded-md border-s-4 border-[#C4511F] bg-white/5 p-3 text-[0.9375rem]">
          <p className="text-[0.8125rem] font-semibold tracking-wide text-[#F0C779] uppercase">
            {NOTE_LABEL(cl, n.noteType)}{n.verified ? ` · ${T[cl].verified}` : ''} · {T[cl].addedOn} {memorialDate(n.at.slice(0, 10), cl)}
          </p>
          <p className="mt-1 text-white/90">{n.text[cl] || n.text.en || n.text.ckb}</p>
          {n.citation?.title && (
            <p className="mt-1 text-[0.875rem] text-white/65">
              {T[cl].source}: {n.citation.url ? <a href={n.citation.url} target="_blank" rel="noopener noreferrer" className="underline">{n.citation.title}</a> : n.citation.title}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
};

/** Ages for the slideshow: the numbers reported, and a note when sources differ. */
const slideAge = (p: MemorialPerson, cl: CL) => {
  const nums = Array.from(new Set(p.ages.map((a) => a.value[cl]).filter((v) => /\d/.test(v))));
  if (!nums.length) return p.ages[0] ? claimText(p.ages[0], cl) : '';
  return nums.length > 1 ? `${nums.join(' / ')} ${cl === 'ckb' ? '(سەرچاوەکان جیاوازن)' : '(sources differ)'}` : nums[0];
};

const personName = (p: MemorialPerson, cl: CL) => (cl === 'ckb' && p.nameKu ? p.nameKu.value.ckb : p.nameEn);

const EventSlide: React.FC<{ e: MemorialEvent; m: MergedMemorial; cl: CL }> = ({ e, m, cl }) => (
  <article className="mx-auto max-w-[820px] text-center">
    <p className="font-serif text-[2.25rem] leading-none font-semibold text-white tabular-nums sm:text-[3.25rem]">{memorialDate(e.date, cl)}</p>
    <span className="mx-auto mt-4 block h-[2px] w-16 bg-[#A3172C]" aria-hidden="true" />
    <p className="mt-4 text-[1.0625rem] text-[#F0C779]">{e.place[cl]}{e.time ? ` · ${e.time[cl]}` : ''}</p>
    <h3 className="mt-3 text-[1.5rem] leading-snug font-semibold text-white sm:text-[1.875rem]">{e.title[cl]}</h3>
    <p className="mx-auto mt-4 max-w-[64ch] text-[1.0938rem] leading-relaxed text-white/85">{e.summary[cl]}</p>
    <div className="mt-4"><SourceList ids={e.sources} m={m} cl={cl} citations={(e as { citations?: { title: string; url?: string }[] }).citations} /></div>
  </article>
);

const Portrait: React.FC<{ p: MemorialPerson; m: MergedMemorial; cl: CL; size?: 'lg' | 'md' }> = ({ p, m, cl, size = 'md' }) => {
  const poster = POSTER_PORTRAITS[p.id];
  const photo = m.portraits[p.id] || (poster ? { dataUrl: poster, credit: cl === 'ckb' ? 'پۆستەری یادکردنەوەی ڕێکخراوی 17ی شوبات' : 'Memorial poster, 17 Shubat Organisation' } : undefined);
  const dim = size === 'lg' ? 'h-40 w-32 sm:h-52 sm:w-40' : 'h-28 w-24';
  return photo?.dataUrl ? (
    <figure className="shrink-0">
      <img src={photo.dataUrl} alt={personName(p, cl)} className={`${dim} rounded-md border border-white/20 object-cover grayscale-[35%]`} />
      <figcaption className="mt-1 max-w-[10rem] text-[0.75rem] text-white/55">{T[cl].credit}: {photo.credit}</figcaption>
    </figure>
  ) : (
    <div className={`${dim} flex shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/[0.04]`} aria-hidden="true">
      <Flame className="h-8 w-8 text-[#C4511F]/80" strokeWidth={1.25} />
    </div>
  );
};

const MartyrSlide: React.FC<{ p: MemorialPerson; m: MergedMemorial; cl: CL }> = ({ p, m, cl }) => (
  <article className="mx-auto flex max-w-[760px] flex-col items-center gap-6 text-center sm:flex-row sm:text-start">
    <Portrait p={p} m={m} cl={cl} size="lg" />
    <div className="min-w-0">
      <h3 className="font-serif text-[2rem] leading-tight font-semibold text-white sm:text-[2.5rem]">{personName(p, cl)}</h3>
      {cl === 'ckb' && p.nameKu && <p className="mt-1 text-white/70"><bdi dir="ltr">{p.nameEn}</bdi></p>}
      {cl === 'en' && p.nameKu && <p className="mt-1 text-white/70"><bdi dir="rtl" lang="ckb" className="font-kurdish">{p.nameKu.value.ckb}</bdi></p>}
      <p className="mt-3 text-[1.0625rem] text-white/85">
        <span>{T[cl].ageReported}: </span>{slideAge(p, cl)}
        {(p.death?.date || p.incident?.date) && <span> · {memorialDate(p.death?.date || p.incident?.date, cl)}</span>}
        {(p.death?.place || p.incident?.place || p.place?.value) && <span> · {(p.incident?.place || p.death?.place || p.place?.value)![cl]}</span>}
      </p>
      <span className="mt-4 block h-[2px] w-14 bg-[#A3172C] max-sm:mx-auto" aria-hidden="true" />
      <p className="mt-4 font-serif text-[1.125rem] text-[#F0C779] italic">{DEDICATION[cl]}</p>
    </div>
  </article>
);

const MartyrCard: React.FC<{ p: MemorialPerson; m: MergedMemorial; cl: CL }> = ({ p, m, cl }) => (
  <article id={`martyr-${p.id}`} className="scroll-mt-24 rounded-xl border border-white/12 bg-white/[0.035] p-5">
    <div className="flex gap-4">
      <Portrait p={p} m={m} cl={cl} />
      <div className="min-w-0">
        <h3 className="font-serif text-[1.375rem] leading-tight font-semibold text-white">{personName(p, cl)}</h3>
        {cl === 'ckb' ? <p className="text-[0.9375rem] text-white/65"><bdi dir="ltr">{p.nameEn}</bdi></p> : p.nameKu && <p className="text-[1rem] text-white/65"><bdi dir="rtl" lang="ckb" className="font-kurdish">{p.nameKu.value.ckb}</bdi></p>}
        <p className="mt-2 text-[0.8125rem] text-white/60">{T[cl].status[p.status]}</p>
      </div>
    </div>
    <dl className="mt-4 space-y-2 text-[0.9375rem]">
      <div><dt className="inline font-semibold text-white/70">{T[cl].ageReported}: </dt>
        <dd className="inline text-white/90">{p.ages.map((a, i) => <React.Fragment key={i}>{i > 0 && '; '}<span className="tabular-nums">{claimText(a, cl)}</span> (<SourceRef id={a.source} m={m} cl={cl} />)</React.Fragment>)}</dd></div>
      {p.incident && <div><dt className="inline font-semibold text-white/70">{T[cl].shot}: </dt><dd className="inline text-white/90">{memorialDate(p.incident.date, cl)}{p.incident.place ? `, ${p.incident.place[cl]}` : ''} (<SourceRef id={p.incident.source} m={m} cl={cl} />)</dd></div>}
      {p.death && <div><dt className="inline font-semibold text-white/70">{T[cl].died}: </dt><dd className="inline text-white/90">{memorialDate(p.death.date, cl)}{p.death.place ? `, ${p.death.place[cl]}` : ''} (<SourceRef id={p.death.source} m={m} cl={cl} />)</dd></div>}
      {p.place && !p.incident && <div><dt className="inline font-semibold text-white/70">{T[cl].place}: </dt><dd className="inline text-white/90">{claimText(p.place, cl)} (<SourceRef id={p.place.source} m={m} cl={cl} />)</dd></div>}
      {p.variants.length > 1 && (
        <div><dt className="inline font-semibold text-white/70">{T[cl].spellings}: </dt>
          <dd className="inline text-white/90">{p.variants.map((v, i) => <React.Fragment key={i}>{i > 0 && '; '}<bdi>{v.name}</bdi> (<SourceRef id={v.source} m={m} cl={cl} />)</React.Fragment>)}</dd></div>
      )}
    </dl>
    {p.circumstances?.length ? (
      <div className="mt-3">
        <p className="text-[0.875rem] font-semibold text-white/70">{T[cl].circumstances}</p>
        <ul className="mt-1 space-y-1.5 text-[0.9375rem] text-white/90">
          {p.circumstances.map((c, i) => <li key={i}>{claimText(c, cl)} <span className="text-white/55">(<SourceRef id={c.source} m={m} cl={cl} />)</span></li>)}
        </ul>
      </div>
    ) : null}
    <Flags flags={p.flags} cl={cl} />
    <Notes id={p.id} m={m} cl={cl} />
    <p className="mt-4 border-t border-white/10 pt-3 font-serif text-[0.9688rem] text-[#F0C779] italic">{DEDICATION[cl]}</p>
  </article>
);

export const MemorialPage: React.FC<{ onNavigate?: (tab: string, param?: string) => void }> = () => {
  const ui = useLang();
  const m = useMemorial();
  const [cl, setCl] = useState<CL>(prefLang);
  const [q, setQ] = useState('');
  const [month, setMonth] = useState('');
  useEffect(() => { try { localStorage.setItem('17shubat_memorial_lang', cl); } catch { /* storage blocked */ } }, [cl]);
  useEffect(() => { document.title = `${MEMORIAL_TITLE.en} | Mashkhally Zhyanawa`; }, []);
  void ui;
  const t = T[cl];
  const dir = cl === 'ckb' ? 'rtl' : 'ltr';

  const filtered = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return m.events.filter((e) => (!month || e.date.slice(5, 7) === month) && words.every((w) => searchText(e, m.people).includes(w) || memorialDate(e.date, cl).toLowerCase().includes(w)));
  }, [m.events, m.people, q, month, cl]);
  const months = Array.from(new Set(m.events.map((e) => e.date.slice(5, 7)))).sort();

  const intro = { key: 'intro', label: cl === 'ckb' ? 'سەرەتا' : 'Introduction', node: (
    <article className="mx-auto max-w-[820px] text-center">
      <img src={LOGO_URL} alt="" className="mx-auto h-16 w-16 rounded-md object-cover" />
      <h3 className="mt-5 font-serif text-[1.75rem] leading-tight font-semibold text-white sm:text-[2.375rem]">{MEMORIAL_TITLE[cl]}</h3>
      <p className="mt-3 text-[1.125rem] text-[#F0C779]">{MEMORIAL_SUBTITLE[cl]}</p>
    </article>
  ) };
  const eventSlides = [intro, ...m.events.filter((e) => e.key || (e as { added?: boolean }).added).map((e) => ({ key: e.id, label: memorialDate(e.date, cl).replace(/ ?2011$|ی 2011$/, ''), node: <EventSlide e={e} m={m} cl={cl} /> }))];
  const martyrSlides = m.people.map((p) => ({ key: p.id, label: personName(p, cl), node: <MartyrSlide p={p} m={m} cl={cl} /> }));

  return (
    <div className="memorial bg-[#090F1C] text-white">
      {/* Banner */}
      <header className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(163,23,44,0.22),transparent_60%)]" aria-hidden="true" />
        <Container className="relative py-10 sm:py-14">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[0.875rem] font-semibold tracking-[0.12em] text-[#F0C779] uppercase">17 Shubat 2011 Memorial</p>
            <div role="group" aria-label={t.language} className="flex overflow-hidden rounded-lg border border-white/25 text-[0.9375rem]" data-i18n-skip="">
              <button type="button" lang="ckb" onClick={() => setCl('ckb')} aria-pressed={cl === 'ckb'} className={`cursor-pointer px-3.5 py-1.5 font-kurdish ${cl === 'ckb' ? 'bg-white text-[#0C1B36]' : 'text-white hover:bg-white/10'}`}>کوردی</button>
              <button type="button" lang="en" onClick={() => setCl('en')} aria-pressed={cl === 'en'} className={`cursor-pointer px-3.5 py-1.5 ${cl === 'en' ? 'bg-white text-[#0C1B36]' : 'text-white hover:bg-white/10'}`}>English</button>
            </div>
          </div>
          <div data-i18n-skip="" lang={cl} dir={dir} className={cl === 'ckb' ? 'font-kurdish' : ''}>
            <h1 className="mt-6 max-w-[22ch] font-serif text-[2.25rem] leading-[1.1] font-semibold text-white sm:text-[3.25rem]">{MEMORIAL_TITLE[cl]}</h1>
            <p className="mt-4 text-[1.1875rem] text-[#F0C779]">{MEMORIAL_SUBTITLE[cl]}</p>
            <span className="mt-6 block h-[3px] w-20 bg-[#A3172C]" aria-hidden="true" />
            <p className="mt-6 max-w-[70ch] text-[1.0938rem] leading-relaxed text-white/85">{MEMORIAL_INTRO[cl]}</p>
            <div className="mt-3"><SourceList ids={MEMORIAL_INTRO_SOURCES} m={m} cl={cl} /></div>
            <div className="mt-3 max-w-[70ch] text-[0.9375rem] text-white/70"><p className="font-semibold">{t.totals}</p>
              <ul className="mt-1 list-disc space-y-1 ps-5">{TOTALS.map((c, i) => <li key={i}>{claimText(c, cl)} (<SourceRef id={c.source} m={m} cl={cl} />)</li>)}</ul></div>
            <nav aria-label={t.nav} className="mt-8 flex flex-wrap gap-2 text-[0.9375rem]">
              {[['days', t.slideshow], ['timeline', t.timeline], ['martyrs', t.martyrs], ['archive', t.archive], ['sources', t.sources]].map(([id, l]) => (
                <a key={id} href={`#${id}`} className="rounded-full border border-white/20 px-3.5 py-1.5 text-white no-underline hover:border-white/50">{l}</a>
              ))}
              <a href="/sherwan-sherwani" className="rounded-full border border-[#F0C779]/50 px-3.5 py-1.5 text-[#F0C779] no-underline hover:border-[#F0C779]">{cl === 'ckb' ? 'شێروان شێروانی' : 'Sherwan Sherwani'}</a>
            </nav>
          </div>
        </Container>
      </header>

      <div data-i18n-skip="" lang={cl} dir={dir} className={cl === 'ckb' ? 'font-kurdish' : ''}>
        {/* The days, as a slideshow */}
        <section id="days" aria-labelledby="days-h" className="scroll-mt-20 border-b border-white/10 py-12 sm:py-16">
          <Container>
            <h2 id="days-h" className="sr-only">{t.slideshow}</h2>
            <MemorialSlideshow slides={eventSlides} labels={t.slides as unknown as SlideshowLabels} dir={dir} intervalMs={11000} />
            <p className="mt-4 text-center text-[0.8125rem] text-white/50">{t.reducedNote}</p>
          </Container>
        </section>

        {/* Timeline */}
        <section id="timeline" aria-labelledby="tl-h" className="scroll-mt-20 border-b border-white/10 py-12 sm:py-16">
          <Container>
            <h2 id="tl-h" className="font-serif text-[1.875rem] font-semibold text-white sm:text-[2.25rem]">{t.timeline}</h2>
            <span className="mt-3 block h-[3px] w-12 bg-[#A3172C]" aria-hidden="true" />
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">{t.search}</span>
                <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-white/50" aria-hidden="true" />
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPh}
                  className="w-full rounded-lg border border-white/20 bg-white/5 py-2.5 pe-3 ps-9 text-white placeholder:text-white/45 focus:border-white/50 focus:outline-none" />
              </label>
              <label className="sm:w-56">
                <span className="sr-only">{t.allMonths}</span>
                <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full rounded-lg border border-white/20 bg-[#101829] px-3 py-2.5 text-white">
                  <option value="">{t.allMonths}</option>
                  {months.map((mo) => <option key={mo} value={mo}>{MONTHS[mo]?.[cl] || mo}</option>)}
                </select>
              </label>
            </div>
            <p className="sr-only" aria-live="polite">{filtered.length}</p>

            {filtered.length === 0 && <p className="mt-8 text-white/70">{t.noMatch}</p>}
            {months.filter((mo) => filtered.some((e) => e.date.slice(5, 7) === mo)).map((mo) => (
              <div key={mo} className="mt-10">
                <h3 className="text-[1.25rem] font-semibold text-[#F0C779]">{MONTHS[mo]?.[cl] || mo}</h3>
                <ol className="mt-4 space-y-5 border-s border-white/15 ps-5 sm:ps-7">
                  {filtered.filter((e) => e.date.slice(5, 7) === mo).map((e) => (
                    <li key={e.id} id={`entry-${e.id}`} className="relative scroll-mt-24">
                      <span className="absolute top-2 -start-[1.6rem] h-3 w-3 rounded-full border-2 border-[#A3172C] bg-[#090F1C] sm:-start-[2.1rem]" aria-hidden="true" />
                      <article className="rounded-xl border border-white/12 bg-white/[0.035] p-5">
                        <p className="text-[0.9375rem] font-semibold text-white tabular-nums">{memorialDate(e.date, cl)}{e.time ? <span className="font-normal text-white/70"> · {e.time[cl]}</span> : null}</p>
                        <p className="text-[0.9375rem] text-[#F0C779]">{e.place[cl]}</p>
                        <h4 className="mt-2 text-[1.25rem] leading-snug font-semibold text-white">{e.title[cl]}</h4>
                        <p className="mt-2 leading-relaxed text-white/85">{e.summary[cl]}</p>
                        {e.figures && <p className="mt-2 text-white/85">{e.figures[cl]}</p>}
                        {e.people?.length ? (
                          <p className="mt-3 text-[0.9375rem]"><span className="font-semibold text-white/70">{t.people}: </span>
                            {e.people.map((id, i) => {
                              const p = m.people.find((x) => x.id === id);
                              return <React.Fragment key={id}>{i > 0 && ' · '}{p ? <a href={`#martyr-${p.id}`} className="underline underline-offset-4">{personName(p, cl)}</a> : <span>{id}</span>}</React.Fragment>;
                            })}
                          </p>
                        ) : null}
                        <div className="mt-3"><SourceList ids={e.sources} m={m} cl={cl} citations={(e as { citations?: { title: string; url?: string }[] }).citations} /></div>
                        <Flags flags={e.flags} cl={cl} />
                        <Notes id={e.id} m={m} cl={cl} />
                        {m.media.filter((x) => x.linkedTo === e.id && x.role !== 'portrait').map((x) => <MediaItem key={x.id} x={x} cl={cl} />)}
                      </article>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            <p className="mt-10 rounded-lg border border-white/12 bg-white/[0.03] p-4 text-[0.9375rem] text-white/75">{TIMELINE_PENDING[cl]}</p>
          </Container>
        </section>

        {/* Martyrs */}
        <section id="martyrs" aria-labelledby="mt-h" className="scroll-mt-20 border-b border-white/10 py-12 sm:py-16">
          <Container>
            <h2 id="mt-h" className="text-center font-serif text-[1.875rem] font-semibold text-white sm:text-[2.5rem]">{MARTYRS_TITLE[cl]}</h2>
            <span className="mx-auto mt-3 block h-[3px] w-14 bg-[#A3172C]" aria-hidden="true" />
            <p className="mt-4 text-center text-white/70">{t.martyrSlides}</p>
            <div className="mt-8"><MemorialSlideshow slides={martyrSlides} labels={t.slides as unknown as SlideshowLabels} dir={dir} intervalMs={13000} /></div>
            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {m.people.map((p) => <MartyrCard key={p.id} p={p} m={m} cl={cl} />)}
            </div>
          </Container>
        </section>

        {/* Archive */}
        <section id="archive" aria-labelledby="ar-h" className="scroll-mt-20 border-b border-white/10 py-12 sm:py-16">
          <Container>
            <h2 id="ar-h" className="font-serif text-[1.875rem] font-semibold text-white sm:text-[2.25rem]">{t.archive}</h2>
            <span className="mt-3 block h-[3px] w-12 bg-[#A3172C]" aria-hidden="true" />
            {m.media.filter((x) => x.role !== 'portrait').length === 0 ? (
              <p className="mt-6 max-w-[70ch] text-white/75">{t.noArchive}</p>
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{m.media.filter((x) => x.role !== 'portrait').map((x) => <MediaItem key={x.id} x={x} cl={cl} />)}</div>
            )}
          </Container>
        </section>

        {/* Sources */}
        <section id="sources" aria-labelledby="so-h" className="scroll-mt-20 py-12 sm:py-16">
          <Container>
            <h2 id="so-h" className="font-serif text-[1.875rem] font-semibold text-white sm:text-[2.25rem]">{t.sources}</h2>
            <span className="mt-3 block h-[3px] w-12 bg-[#A3172C]" aria-hidden="true" />
            <ol className="mt-6 space-y-4">
              {m.sources.map((s) => (
                <li key={s.id} id={`source-${s.id}`} className="scroll-mt-24 rounded-xl border border-white/12 bg-white/[0.035] p-5">
                  <p className="font-semibold text-white">{s.title[cl]}</p>
                  <p className="text-[0.9375rem] text-white/70">{s.publisher}{s.date ? ` · ${memorialDate(s.date, cl)}` : ''}</p>
                  {s.note && <p className="mt-2 text-[0.9375rem] text-white/80">{s.note[cl]}</p>}
                  {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[0.9375rem] underline underline-offset-4">{t.open} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>}
                  {s.pending && <p className="mt-2 text-[0.875rem] text-[#F0C779]">{t.pending}</p>}
                  {(s.originalText || s.translation) && (
                    <details className="mt-3">
                      <summary className="cursor-pointer font-semibold">{t.original} / {t.englishT}</summary>
                      <div className="mt-3 grid gap-4 lg:grid-cols-2">
                        {s.originalText && <div dir="rtl" lang="ckb" className="max-h-[32rem] overflow-y-auto rounded-md bg-white/5 p-4 font-kurdish whitespace-pre-line text-white/90"><p className="mb-2 text-[0.8125rem] font-semibold text-white/60">{T.ckb.original}</p>{s.originalText}</div>}
                        {s.translation && <div dir="ltr" lang="en" className="max-h-[32rem] overflow-y-auto rounded-md bg-white/5 p-4 whitespace-pre-line text-white/90"><p className="mb-2 text-[0.8125rem] font-semibold text-white/60">{T.en.englishT}</p>{s.translation}</div>}
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          </Container>
        </section>
      </div>
    </div>
  );
};

const MediaItem: React.FC<{ x: MergedMemorial['media'][number]; cl: CL }> = ({ x, cl }) => {
  const embed = x.mediaType === 'video' && x.url ? videoEmbed(x.url) : null;
  return (
    <figure className="mt-3 overflow-hidden rounded-lg border border-white/12 bg-white/[0.03]">
      {x.mediaType === 'image' && x.dataUrl && <img src={x.dataUrl} alt={x.caption[cl] || x.caption.en} className="w-full object-cover" loading="lazy" />}
      {embed && <div className="aspect-video"><iframe src={embed.src} title={x.caption[cl] || x.caption.en} className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div>}
      <figcaption className="p-3 text-[0.875rem] text-white/80">
        {x.caption[cl] || x.caption.en}
        <span className="block text-white/55">{T[cl].credit}: {x.credit}</span>
        {x.transcript && <details className="mt-2"><summary className="cursor-pointer font-semibold">{T[cl].transcript}</summary><p className="mt-1 whitespace-pre-line">{x.transcript}</p></details>}
      </figcaption>
    </figure>
  );
};
