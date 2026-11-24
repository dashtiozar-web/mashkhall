import React, { useEffect, useState } from 'react';
import { ExternalLink, AlertTriangle, UserRound } from 'lucide-react';
import { Container } from '../components/ui';
import { MemorialSlideshow, SlideshowLabels } from '../components/MemorialSlideshow';
import { Bi, memorialDate } from '../data/memorial';
import { S_CALL, S_EVENTS, S_PROFILE, S_SLIDES_TITLE, S_SOURCES, S_STATUS, S_SUBTITLE, S_TITLE, SEvent } from '../data/sherwani';
import { useMemorial } from '../lib/memorial';
import { getLang } from '../i18n/lang';

/**
 * Sherwan Sherwani — former member of 17 Shubat Organisation: his
 * journalism, the reported arrests and imprisonment, and press-freedom
 * concerns. Kurdish (Sorani) or English, chosen on the page. Every
 * statement shows its source; the authorities', family's and advocates'
 * accounts are kept apart; the current status is date-stamped.
 * Photographs are added by administrators (with credit and permission)
 * from Administration → 17 Shubat 2011 Memorial.
 */

type CL = 'en' | 'ckb';

const T = {
  en: {
    language: 'Language', profile: 'Profile', formerMember: 'Former member of 17 Shubat Organisation', timeline: 'Timeline', sources: 'Sources', status: 'Current status',
    lastReport: 'Most recent report', checked: 'Checked on', source: 'Source', sourcesLabel: 'Sources', verify: 'To be verified', photos: 'Photographs',
    noPhoto: 'An approved photograph will be added here.', credit: 'Credit', open: 'Open', author: 'Author', published: 'Published', also: 'Also known as',
    who: { authorities: 'The authorities’ account', family: 'His family’s account', lawyer: 'His lawyer’s account', advocates: 'Press-freedom organisations', commission: 'Independent Human Rights Commission' },
    update: 'Status update', verifiedOn: 'verified on', slides: { previous: 'Previous', next: 'Next', pause: 'Pause', play: 'Play', slide: (n: number, t: number) => `Slide ${n} of ${t}`, region: 'Slideshow' },
    s: ['Who is Sherwan Sherwani?', 'A record of arrests', 'The October 2020 case', 'Press-freedom concerns', 'The 2026 hunger strike', 'Current status', 'A call for transparency and due process'],
    memorial: '17 Shubat 2011 Memorial', notInSource: 'Kurmanji: not yet available.',
  },
  ckb: {
    language: 'زمان', profile: 'ناساندن', formerMember: 'ئەندامی پێشووی ڕێکخراوی 17ی شوبات', timeline: 'ڕیزبەندیی ڕووداوەکان', sources: 'سەرچاوەکان', status: 'باری ئێستا',
    lastReport: 'نوێترین ڕاپۆرت', checked: 'پشکنراوە لە', source: 'سەرچاوە', sourcesLabel: 'سەرچاوەکان', verify: 'پێویستی بە پشتڕاستکردنەوەیە', photos: 'وێنەکان',
    noPhoto: 'وێنەیەکی پەسەندکراو لێرە زیاد دەکرێت.', credit: 'مافی وێنە', open: 'کردنەوە', author: 'نووسەر', published: 'بڵاوکراوەتەوە', also: 'هەروەها ناسراوە بە',
    who: { authorities: 'گێڕانەوەی دەسەڵاتداران', family: 'گێڕانەوەی خێزانەکەی', lawyer: 'گێڕانەوەی پارێزەرەکەی', advocates: 'ڕێکخراوەکانی ئازادیی ڕۆژنامەگەری', commission: 'کۆمیسیۆنی سەربەخۆی مافی مرۆڤ' },
    update: 'نوێکردنەوەی بار', verifiedOn: 'پشتڕاستکراوە لە', slides: { previous: 'پێشوو', next: 'داهاتوو', pause: 'ڕاگرتن', play: 'لێدان', slide: (n: number, t: number) => `سلایدی ${n} لە ${t}`, region: 'پیشاندانی سلاید' },
    s: ['شێروان شێروانی کێیە؟', 'تۆماری دەستگیرکردنەکان', 'دۆسیەی تشرینی یەکەمی 2020', 'نیگەرانییەکانی ئازادیی ڕۆژنامەگەری', 'مانگرتنی 2026', 'باری ئێستا', 'داوایەک بۆ شەفافیەت و دادگاییکردنی دادپەروەرانە'],
    memorial: 'یادگاری 17ی شوباتی 2011', notInSource: 'کورمانجی: هێشتا بەردەست نییە.',
  },
} as const;

const prefLang = (): CL => {
  try { const s = localStorage.getItem('17shubat_memorial_lang'); if (s === 'en' || s === 'ckb') return s; } catch { /* storage blocked */ }
  return getLang() === 'ckb' ? 'ckb' : 'en';
};

const dateOf = (e: SEvent, cl: CL) => e.dateLabel?.[cl] || memorialDate(e.date, cl);

const Ref: React.FC<{ id: string }> = ({ id }) => {
  const s = S_SOURCES.find((x) => x.id === id);
  if (!s) return null;
  return <a href={`#ss-source-${s.id}`} className="underline decoration-white/30 underline-offset-4 hover:decoration-white"><bdi dir="ltr">{(s.publisher.match(/\(([A-Z]{2,})\)/)?.[1]) || s.publisher.replace(/ \(.*\)$/, '')}, {s.date.slice(0, 4)}</bdi></a>;
};

const Refs: React.FC<{ ids: string[]; cl: CL }> = ({ ids, cl }) => (
  <p className="text-[0.875rem] text-white/65"><span className="font-semibold">{ids.length > 1 ? T[cl].sourcesLabel : T[cl].source}:</span>{' '}
    {ids.map((id, i) => <React.Fragment key={id}>{i > 0 && ' · '}<Ref id={id} /></React.Fragment>)}</p>
);

const Flags: React.FC<{ flags?: Bi[]; cl: CL }> = ({ flags, cl }) => flags?.length ? (
  <div className="mt-3 rounded-md border border-amber/40 bg-amber/10 p-3 text-[0.9063rem]">
    <p className="flex items-center gap-1.5 font-semibold text-[#F0C779]"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> {T[cl].verify}</p>
    <ul className="mt-1 list-disc space-y-0.5 ps-5 text-white/85">{flags.map((f, i) => <li key={i}>{f[cl]}</li>)}</ul>
  </div>
) : null;

const Slide: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <article className="mx-auto max-w-[820px]">
    <h3 className="text-center font-serif text-[1.625rem] leading-tight font-semibold text-white sm:text-[2.125rem]">{title}</h3>
    <span className="mx-auto mt-4 block h-[2px] w-16 bg-[#A3172C]" aria-hidden="true" />
    <div className="mt-5 text-[1.0625rem] leading-relaxed text-white/85">{children}</div>
  </article>
);

export const SherwaniPage: React.FC = () => {
  const m = useMemorial();
  const [cl, setCl] = useState<CL>(prefLang);
  useEffect(() => { try { localStorage.setItem('17shubat_memorial_lang', cl); } catch { /* storage blocked */ } }, [cl]);
  useEffect(() => { document.title = `${S_TITLE.en} | Mashkhally Zhyanawa`; }, []);
  const t = T[cl];
  const dir = cl === 'ckb' ? 'rtl' : 'ltr';
  // An approved portrait added from Administration replaces the one supplied by the organisation.
  const portrait = m.portraits['sherwani'] || {
    dataUrl: '/images/sherwan-sherwani.jpg',
    credit: cl === 'ckb' ? 'وێنە لەلایەن ڕێکخراوی 17ی شوباتەوە دابین کراوە' : 'Photograph supplied by 17 Shubat Organisation',
  };
  const photos = m.media.filter((x) => x.linkedTo === 'sherwani' && x.role !== 'portrait');
  // Verified status updates added from Administration (newest first).
  const updates = [...(m.notes['sherwani-status'] || [])].reverse();
  const latest = updates.find((u) => u.verified);

  const ev = (id: string) => S_EVENTS.find((e) => e.id === id)!;
  const arrests = ['ss-2012', 'ss-2019', 'ss-2020-arrest', 'ss-2021', 'ss-2023', 'ss-2025'].map(ev);
  const statusText = latest ? (latest.text[cl] || latest.text.en) : S_STATUS.text[cl];
  const statusDate = latest ? latest.at.slice(0, 10) : S_STATUS.checkedOn;

  const slides = [
    { key: 's1', label: t.s[0], node: <Slide title={t.s[0]}><p>{S_PROFILE.intro[cl]}</p><p className="mt-3">{S_PROFILE.membership[cl]}</p><div className="mt-3"><Refs ids={[...S_PROFILE.introSources]} cl={cl} /></div></Slide> },
    { key: 's2', label: t.s[1], node: <Slide title={t.s[1]}><ul className="space-y-2">{arrests.map((e) => <li key={e.id}><span className="font-semibold text-[#F0C779]">{dateOf(e, cl)}</span> — {e.title[cl]}</li>)}</ul></Slide> },
    { key: 's3', label: t.s[2], node: <Slide title={t.s[2]}>{ev('ss-2020-allegations').accounts!.map((a, i) => <p key={i} className="mt-2"><span className="font-semibold text-[#F0C779]">{t.who[a.who]}: </span>{a.text[cl]}</p>)}</Slide> },
    { key: 's4', label: t.s[3], node: <Slide title={t.s[3]}><p>{ev('ss-2025-09').body[cl]}</p><p className="mt-3">{ev('ss-2025').body[cl]}</p><div className="mt-3"><Refs ids={['cpj-2025-09', 'rsf-2025', 'amnesty-2025']} cl={cl} /></div></Slide> },
    { key: 's5', label: t.s[4], node: <Slide title={t.s[4]}><p>{ev('ss-2026-hunger').body[cl]}</p>{ev('ss-2026-hunger').accounts!.slice(0, 1).map((a, i) => <p key={i} className="mt-2">{a.text[cl]}</p>)}<p className="mt-2">{ev('ss-2026-05-03').accounts![0].text[cl]}</p><div className="mt-3"><Refs ids={['ch8-2026-04', 'rudaw-2026']} cl={cl} /></div></Slide> },
    { key: 's6', label: t.s[5], node: <Slide title={t.s[5]}><p>{statusText}</p><p className="mt-2 text-[0.9375rem] text-white/65">{t.checked} {memorialDate(statusDate, cl)}</p></Slide> },
    { key: 's7', label: t.s[6], node: <Slide title={t.s[6]}><p>{S_CALL[cl]}</p></Slide> },
  ];

  return (
    <div className="memorial bg-[#090F1C] text-white">
      <header className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(163,23,44,0.18),transparent_60%)]" aria-hidden="true" />
        <Container className="relative py-10 sm:py-14">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <a href="/memorial" className="text-[0.875rem] font-semibold tracking-[0.12em] text-[#F0C779] uppercase no-underline hover:underline">{t.memorial}</a>
            <div role="group" aria-label={t.language} className="flex overflow-hidden rounded-lg border border-white/25 text-[0.9375rem]" data-i18n-skip="">
              <button type="button" lang="ckb" onClick={() => setCl('ckb')} aria-pressed={cl === 'ckb'} className={`cursor-pointer px-3.5 py-1.5 font-kurdish ${cl === 'ckb' ? 'bg-white text-[#0C1B36]' : 'text-white hover:bg-white/10'}`}>کوردی</button>
              <button type="button" lang="en" onClick={() => setCl('en')} aria-pressed={cl === 'en'} className={`cursor-pointer px-3.5 py-1.5 ${cl === 'en' ? 'bg-white text-[#0C1B36]' : 'text-white hover:bg-white/10'}`}>English</button>
            </div>
          </div>
          <div data-i18n-skip="" lang={cl} dir={dir} className={`mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start ${cl === 'ckb' ? 'font-kurdish' : ''}`}>
            <div>
              <h1 className="max-w-[24ch] font-serif text-[2.125rem] leading-[1.12] font-semibold text-white sm:text-[3rem]">{S_TITLE[cl]}</h1>
              <p className="mt-4 text-[1.125rem] text-[#F0C779]">{S_SUBTITLE[cl]}</p>
              <span className="mt-6 block h-[3px] w-20 bg-[#A3172C]" aria-hidden="true" />
              <p className="mt-6 max-w-[68ch] text-[1.0938rem] leading-relaxed text-white/85">{S_PROFILE.intro[cl]}</p>
              <div className="mt-2"><Refs ids={[...S_PROFILE.introSources]} cl={cl} /></div>
            </div>
            {/* Profile card */}
            <aside className="rounded-xl border border-white/12 bg-white/[0.04] p-5" aria-label={t.profile}>
              {portrait?.dataUrl ? (
                <figure>
                  <img src={portrait.dataUrl} alt={cl === 'ckb' ? S_PROFILE.nameKu : S_PROFILE.nameEn} className="aspect-[4/5] w-full rounded-md object-cover object-top" />
                  <figcaption className="mt-1 text-[0.75rem] text-white/55">{t.credit}: {portrait.credit}</figcaption>
                </figure>
              ) : (
                <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-md border border-white/12 bg-white/[0.03] text-center text-[0.875rem] text-white/55">
                  <UserRound className="h-12 w-12" strokeWidth={1.25} aria-hidden="true" /><span className="px-4">{t.noPhoto}</span>
                </div>
              )}
              <p className="mt-4 font-serif text-[1.375rem] font-semibold text-white">{cl === 'ckb' ? S_PROFILE.nameKu : S_PROFILE.nameEn}</p>
              <p className="text-white/65"><bdi dir={cl === 'ckb' ? 'ltr' : 'rtl'} className={cl === 'ckb' ? '' : 'font-kurdish'}>{cl === 'ckb' ? S_PROFILE.nameEn : S_PROFILE.nameKu}</bdi></p>
              <p className="mt-1 text-[0.875rem] text-white/60">{t.also}: <bdi dir="ltr">{S_PROFILE.altNames.map((a) => a.name).join(', ')}</bdi></p>
              <p className="mt-3 inline-block rounded-full border border-[#F0C779]/50 px-3 py-1 text-[0.875rem] font-semibold text-[#F0C779]">{t.formerMember}</p>
              <p className="mt-3 text-[0.9375rem] text-white/80">{S_PROFILE.membership[cl]}</p>
              <div className="mt-2"><Refs ids={[...S_PROFILE.membershipSources]} cl={cl} /></div>
            </aside>
          </div>
        </Container>
      </header>

      <div data-i18n-skip="" lang={cl} dir={dir} className={cl === 'ckb' ? 'font-kurdish' : ''}>
        {/* Status */}
        <section aria-labelledby="ss-status" className="border-b border-white/10 py-10">
          <Container>
            <div className="rounded-xl border-s-4 border-[#A3172C] bg-white/[0.04] p-5 sm:p-6">
              <h2 id="ss-status" className="text-[1.25rem] font-semibold text-white">{t.status}</h2>
              <p className="mt-2 text-[1.0625rem] text-white/90">{statusText}</p>
              <p className="mt-2 text-[0.9375rem] text-white/65">
                {latest ? <>{t.verifiedOn} {memorialDate(latest.at.slice(0, 10), cl)}{latest.citation?.title && <> · {t.source}: {latest.citation.url ? <a href={latest.citation.url} target="_blank" rel="noopener noreferrer" className="underline">{latest.citation.title}</a> : latest.citation.title}</>}</>
                  : <>{t.lastReport}: <Ref id={S_STATUS.lastReport.source} /> ({memorialDate(S_STATUS.lastReport.date, cl)}) · {t.checked} {memorialDate(S_STATUS.checkedOn, cl)}</>}
              </p>
            </div>
          </Container>
        </section>

        {/* Slideshow */}
        <section aria-labelledby="ss-slides" className="border-b border-white/10 py-12 sm:py-16">
          <Container>
            <h2 id="ss-slides" className="text-center font-serif text-[1.5rem] font-semibold text-white sm:text-[1.875rem]">{S_SLIDES_TITLE[cl]}</h2>
            <div className="mt-8"><MemorialSlideshow slides={slides} labels={t.slides as unknown as SlideshowLabels} dir={dir} intervalMs={14000} /></div>
          </Container>
        </section>

        {/* Timeline */}
        <section id="ss-timeline" aria-labelledby="ss-tl" className="border-b border-white/10 py-12 sm:py-16">
          <Container>
            <h2 id="ss-tl" className="font-serif text-[1.875rem] font-semibold text-white sm:text-[2.25rem]">{t.timeline}</h2>
            <span className="mt-3 block h-[3px] w-12 bg-[#A3172C]" aria-hidden="true" />
            <ol className="mt-8 space-y-5 border-s border-white/15 ps-5 sm:ps-7">
              {S_EVENTS.map((e) => (
                <li key={e.id} id={e.id} className="relative scroll-mt-24">
                  <span className="absolute top-2 -start-[1.6rem] h-3 w-3 rounded-full border-2 border-[#A3172C] bg-[#090F1C] sm:-start-[2.1rem]" aria-hidden="true" />
                  <article className="rounded-xl border border-white/12 bg-white/[0.035] p-5">
                    <p className="font-semibold text-white tabular-nums">{dateOf(e, cl)}</p>
                    {e.place && <p className="text-[0.9375rem] text-[#F0C779]">{e.place[cl]}</p>}
                    <h3 className="mt-2 text-[1.25rem] leading-snug font-semibold text-white">{e.title[cl]}</h3>
                    <p className="mt-2 leading-relaxed text-white/85">{e.body[cl]}</p>
                    {e.accounts?.map((a, i) => (
                      <div key={i} className="mt-3 rounded-md border-s-4 border-white/25 bg-white/[0.03] p-3">
                        <p className="text-[0.8125rem] font-semibold tracking-wide text-[#F0C779] uppercase">{t.who[a.who]}</p>
                        <p className="mt-1 text-white/90">{a.text[cl]}</p>
                        <p className="mt-1 text-[0.8125rem] text-white/60">{t.source}: <Ref id={a.source} /></p>
                      </div>
                    ))}
                    <div className="mt-3"><Refs ids={e.sources} cl={cl} /></div>
                    <Flags flags={e.flags} cl={cl} />
                    {(m.notes[e.id] || []).map((n, i) => (
                      <p key={i} className="mt-3 rounded-md border-s-4 border-[#C4511F] bg-white/5 p-3 text-[0.9375rem]">{n.text[cl] || n.text.en}{n.citation?.title ? ` — ${n.citation.title}` : ''}</p>
                    ))}
                  </article>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        {/* Photographs */}
        {photos.length > 0 && (
          <section aria-labelledby="ss-ph" className="border-b border-white/10 py-12">
            <Container>
              <h2 id="ss-ph" className="font-serif text-[1.875rem] font-semibold text-white">{t.photos}</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {photos.map((x) => (
                  <figure key={x.id} className="overflow-hidden rounded-lg border border-white/12 bg-white/[0.03]">
                    {x.dataUrl && <img src={x.dataUrl} alt={x.caption[cl] || x.caption.en} className="w-full object-cover" loading="lazy" />}
                    <figcaption className="p-3 text-[0.875rem] text-white/80">{x.caption[cl] || x.caption.en}<span className="block text-white/55">{t.credit}: {x.credit}</span></figcaption>
                  </figure>
                ))}
              </div>
            </Container>
          </section>
        )}

        {/* Sources */}
        <section aria-labelledby="ss-so" className="py-12 sm:py-16">
          <Container>
            <h2 id="ss-so" className="font-serif text-[1.875rem] font-semibold text-white">{t.sources}</h2>
            <span className="mt-3 block h-[3px] w-12 bg-[#A3172C]" aria-hidden="true" />
            <ol className="mt-6 space-y-3">
              {S_SOURCES.map((s) => (
                <li key={s.id} id={`ss-source-${s.id}`} className="scroll-mt-24 rounded-xl border border-white/12 bg-white/[0.035] p-4">
                  <p className="font-semibold text-white"><bdi dir={s.language === 'ckb' ? 'rtl' : 'ltr'}>{s.title}</bdi></p>
                  <p className="text-[0.9375rem] text-white/70"><bdi dir="ltr">{s.publisher}</bdi>{s.author && <> · {t.author}: <bdi>{s.author}</bdi></>} · {t.published} {/^\d{4}-\d{2}-\d{2}$/.test(s.date) ? memorialDate(s.date, cl) : s.date.slice(0, 7)} · {s.language === 'ckb' ? 'کوردی / Kurdish' : 'English'}</p>
                  {s.note && <p className="mt-1 text-[0.9375rem] text-white/80">{s.note[cl]}</p>}
                  {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[0.9375rem] underline underline-offset-4">{t.open} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>}
                </li>
              ))}
            </ol>
            <p className="mt-6 text-[0.875rem] text-white/55">{t.notInSource}</p>
          </Container>
        </section>
      </div>
    </div>
  );
};
