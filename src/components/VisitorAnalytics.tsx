import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Globe2, Search, ShieldCheck } from 'lucide-react';
import { auth } from '../firebase';
import { useData } from '../context/DataContext';
import { placeName, PartTotals, Period, PERIODS, useVisitorStats, VisitorStats } from '../lib/visits';
import { localeOf } from '../i18n/lang';
import { WorldMap } from './WorldMap';
import { Flag } from './Flag';

/**
 * Visitors from around the world, by country.
 *
 * Every country that genuine traffic comes from is listed and drawn on the
 * map automatically: nothing is limited to a fixed list. Locations are
 * estimates made by the hosting provider from each connection (VPNs, proxies
 * and mobile networks can place people elsewhere). IP addresses are never
 * stored or shown.
 *
 * The public version shows totals per country. Administrators also see
 * members and visitors separately, any date range, and can download the
 * figures.
 */

type Mode = 'public' | 'admin';
type Audience = 'all' | 'members' | 'visitors';
type SortKey = 'country' | 'visits' | 'people' | 'share';

const n = (x: number) => x.toLocaleString('en-GB');
const part = (p: PartTotals | undefined) => (p && p.people !== null ? n(p.people) : `fewer than ${p?.fewerThan || 5}`);
const dateText = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString(localeOf(), opts);

const PUBLIC_PERIODS: Period[] = ['all', '7d', '30d', '365d'];

interface Row { code: string; visits: number; people: number }

const rowsFor = (s: VisitorStats, audience: Audience): Row[] =>
  s.countries.map((c) => {
    const memberPeople = c.members || 0;
    const memberVisits = c.memberVisits || 0;
    if (audience === 'members') return { code: c.code, people: memberPeople, visits: memberVisits };
    if (audience === 'visitors') return { code: c.code, people: c.people - memberPeople, visits: c.visits - memberVisits };
    return { code: c.code, people: c.people, visits: c.visits };
  }).filter((r) => r.visits > 0 || r.people > 0);

/** Visitors per day. */
const Trend: React.FC<{ days: { day: string; people: number; visits: number }[] }> = ({ days }) => {
  if (days.length < 2) return null;
  const max = Math.max(1, ...days.map((d) => d.visits));
  return (
    <figure className="m-0">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-[1rem] font-semibold">Visits per day</span>
        <span className="flex items-center gap-3 text-[0.75rem] text-muted">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-navy" aria-hidden="true" />Visits</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-ember" aria-hidden="true" />Visitors</span>
        </span>
      </figcaption>
      <div className="mt-3 flex h-28 items-end gap-[2px]" dir="ltr" role="img" aria-label={`Visits per day over ${days.length} days, up to ${max} a day`}>
        {days.map((d) => (
          <span key={d.day} title={`${dateText(d.day, { day: 'numeric', month: 'short' })}: ${d.visits} / ${d.people}`} className="relative flex h-full min-w-0 flex-1 items-end">
            <span className="block w-full rounded-t-sm bg-navy/80" style={{ height: `${Math.max(3, (d.visits / max) * 100)}%` }} />
            <span className="absolute inset-x-[25%] bottom-0 block rounded-t-sm bg-ember" style={{ height: `${Math.max(2, (d.people / max) * 100)}%` }} />
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[0.75rem] text-muted" dir="ltr">
        <span>{dateText(days[0].day, { day: 'numeric', month: 'short' })}</span>
        <span>{dateText(days[days.length - 1].day, { day: 'numeric', month: 'short' })}</span>
      </div>
    </figure>
  );
};

const RegionCard: React.FC<{ code: string; title: string; a: [string, PartTotals | undefined]; b: [string, PartTotals | undefined]; note: string }> = ({ code, title, a, b, note }) => (
  <div className="rounded-xl border border-line border-t-4 border-t-crimson bg-surface p-4">
    <h4 className="flex items-center gap-2 font-sans text-[1rem] font-semibold"><span aria-hidden="true"><Flag code={code} /></span> {title}</h4>
    <dl className="mt-2 space-y-1.5">
      {[a, b].map(([label, v]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
          <dt>{label}</dt>
          <dd className="text-end tabular-nums"><strong className={v?.people === null ? 'text-[0.875rem] font-normal text-muted' : 'text-[1.125rem]'}>{part(v)}</strong></dd>
        </div>
      ))}
    </dl>
    <p className="mt-2 text-[0.75rem] text-muted">{note}</p>
  </div>
);

const CountryTable: React.FC<{ rows: Row[]; total: number; selected: string | null; onSelect: (c: string | null) => void; admin: boolean }> = ({ rows, total, selected, onSelect, admin }) => {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'visits', dir: -1 });
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = rows.filter((r) => !needle || placeName(r.code).toLowerCase().includes(needle) || r.code.toLowerCase() === needle);
    const val = (r: Row) => (sort.key === 'country' ? placeName(r.code) : sort.key === 'share' ? r.visits : r[sort.key]);
    return filtered.sort((a, b) => {
      const x = val(a); const y = val(b);
      const c = typeof x === 'string' ? x.localeCompare(y as string, localeOf()) : (x as number) - (y as number);
      return c * sort.dir || b.visits - a.visits;
    });
  }, [rows, q, sort]);
  const shown = all || q ? sorted : sorted.slice(0, 12);
  const head = (key: SortKey, label: string, end = true) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={`py-2 font-semibold ${end ? 'text-end' : 'text-start'}`}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'country' ? 1 : -1 }))}
        className={`inline-flex cursor-pointer items-center gap-1 hover:text-ink ${sort.key === key ? 'text-ink' : ''}`}>
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />)}
      </button>
    </th>
  );
  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search countries</span>
        <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries"
          className="block w-full rounded-lg border border-line bg-surface py-2 ps-9 pe-3 text-[0.9375rem] focus:border-navy focus:outline-none" />
      </label>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[320px] text-[0.9375rem]">
          <caption className="sr-only">Visits by country{admin ? '' : ' (estimated)'}</caption>
          <thead className="border-b border-line text-[0.8125rem] text-muted">
            <tr>{head('country', 'Country', false)}{head('visits', 'Visits')}{head('people', 'Visitors')}{head('share', 'Share')}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.length === 0 ? (
              <tr><td colSpan={4} className="py-4 text-center text-muted">{q ? 'No country matches your search.' : 'No visits counted in this period.'}</td></tr>
            ) : shown.map((r) => (
              <tr key={r.code} className={`cursor-pointer ${selected === r.code ? 'bg-amber-tint' : 'hover:bg-stone/60'}`} onClick={() => onSelect(selected === r.code ? null : r.code)}>
                <td className="py-2 pe-2">
                  <span className="flex min-w-0 items-center gap-2"><span className="text-[1.125rem] leading-none" aria-hidden="true"><Flag code={r.code} /></span><span className="truncate font-medium">{placeName(r.code)}</span></span>
                </td>
                <td className="py-2 text-end font-semibold tabular-nums">{n(r.visits)}</td>
                <td className="py-2 text-end tabular-nums">{n(r.people)}</td>
                <td className="py-2 text-end text-ink-soft tabular-nums">{total ? `${((r.visits / total) * 100).toFixed(r.visits / total < 0.1 ? 1 : 0)}%` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!q && sorted.length > 12 && (
        <button type="button" onClick={() => setAll((a) => !a)} className="mt-3 cursor-pointer font-semibold text-navy underline underline-offset-4">
          {all ? 'Show the top 12' : `Show all ${sorted.length} countries`}
        </button>
      )}
    </div>
  );
};

const toCsv = (s: VisitorStats) => {
  const lines = [['country_code', 'country', 'visits', 'visitors', 'member_visits', 'members'].join(',')];
  s.countries.forEach((c) => lines.push([c.code, `"${placeName(c.code).replace(/"/g, '""')}"`, c.visits, c.people, c.memberVisits || 0, c.members || 0].join(',')));
  return lines.join('\n');
};

export const VisitorAnalytics: React.FC<{ mode?: Mode }> = ({ mode = 'public' }) => {
  const admin = mode === 'admin';
  const [period, setPeriod] = useState<Period>(admin ? '30d' : 'all');
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [draft, setDraft] = useState({ from: '', to: new Date().toISOString().slice(0, 10) });
  const [audience, setAudience] = useState<Audience>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const stats = useVisitorStats(period, admin ? { custom, token: () => auth.currentUser?.getIdToken() ?? Promise.resolve(undefined) } : {});
  const { articles } = useData();

  // Reads of human-rights reports and demonstration coverage (each reader once a day).
  const reportReads = useMemo(() => articles
    .filter((a) => a.status === 'published' && (a.contentType === 'monitoring_report' || a.category === 'legal'
      || (a.tags || []).some((t) => /protest|demonstration|human rights|mobilisation/i.test(t))))
    .reduce((sum, a) => sum + (a.viewsCount || 0), 0), [articles]);

  const rows = useMemo(() => (stats ? rowsFor(stats, admin ? audience : 'all') : []), [stats, audience, admin]);
  const totalVisits = rows.reduce((s, r) => s + r.visits, 0);
  const totalPeople = rows.reduce((s, r) => s + r.people, 0);

  // Not available, for example on a test copy of the site: the public page hides the section.
  if (stats === null && !admin) return null;

  const periods = admin ? PERIODS : PERIODS.filter((p) => PUBLIC_PERIODS.includes(p.id));
  // The Kurdistan Region and the rest of Iraq count as one country here.
  const knownCountries = new Set(rows.filter((r) => r.code !== 'XX' && r.code !== 'T1').map((r) => r.code.split('-')[0])).size;
  const kr = rows.find((r) => r.code === 'IQ-KR');
  const beforeDaily = stats?.range && stats.dailySince && stats.range.from < stats.dailySince;

  const download = () => {
    if (!stats) return;
    const blob = new Blob([toCsv(stats)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `17shubat-visitors-${stats.range ? `${stats.range.from}_${stats.range.to}` : 'all-time'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section aria-labelledby={`world-visitors-${mode}`} className={admin ? 'space-y-6' : 'overflow-hidden rounded-2xl border border-line bg-surface'}>
      <div className={admin ? 'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between' : 'band-texture flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8'}>
        <div>
          <p className={`flex items-center gap-2 text-[0.875rem] font-semibold ${admin ? 'text-crimson' : 'text-[#F0C779]'}`}><Globe2 className="h-4 w-4" aria-hidden="true" /> {admin ? 'Administrators only' : 'Our readers worldwide'}</p>
          <h2 id={`world-visitors-${mode}`} className={`mt-1 leading-tight font-semibold ${admin ? 'text-[1.5rem]' : 'text-[1.75rem]'}`}>{admin ? 'Visitor analytics' : 'Visitors from around the world'}</h2>
          {stats?.since && <p className={`mt-1 text-[0.875rem] ${admin ? 'text-muted' : 'text-white/70'}`}>Counting since {dateText(stats.since, { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`period-${mode}`}>Period</label>
          <select id={`period-${mode}`} value={custom ? 'custom' : period}
            onChange={(e) => { if (e.target.value !== 'custom') { setCustom(null); setPeriod(e.target.value as Period); } }}
            className={`rounded-lg border px-3 py-2 text-[0.9375rem] font-semibold ${admin ? 'border-line bg-surface' : 'border-white/25 bg-[#0C1B36] text-white'}`}>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            {custom && <option value="custom">Chosen dates</option>}
          </select>
          {admin && (
            <button type="button" onClick={download} disabled={!stats} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[0.9375rem] font-semibold hover:border-navy disabled:opacity-50">
              <Download className="h-4 w-4" aria-hidden="true" /> Download CSV
            </button>
          )}
        </div>
      </div>

      <div className={admin ? 'space-y-6' : 'space-y-6 p-5 sm:p-8'}>
        {admin && (
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 lg:flex-row lg:items-end lg:justify-between">
            <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (draft.from && draft.to && draft.from <= draft.to) setCustom({ ...draft }); }}>
              <label className="text-[0.875rem] font-semibold">From<input type="date" value={draft.from} max={draft.to} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className="mt-1 block rounded-lg border border-line bg-paper px-2 py-1.5 font-normal" required /></label>
              <label className="text-[0.875rem] font-semibold">To<input type="date" value={draft.to} min={draft.from} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className="mt-1 block rounded-lg border border-line bg-paper px-2 py-1.5 font-normal" required /></label>
              <button type="submit" className="cursor-pointer rounded-lg bg-navy px-4 py-2 font-semibold text-white">Show these dates</button>
            </form>
            <div role="group" aria-label="Who to count" className="inline-flex overflow-hidden rounded-lg border border-line">
              {([['all', 'Everyone'], ['members', 'Signed-in members'], ['visitors', 'Visitors']] as [Audience, string][]).map(([id, label], i) => (
                <button key={id} type="button" aria-pressed={audience === id} onClick={() => setAudience(id)}
                  className={`cursor-pointer px-3 py-2 text-[0.875rem] font-semibold ${i ? 'border-s border-line' : ''} ${audience === id ? 'bg-navy text-white' : 'bg-surface hover:bg-stone'}`}>{label}</button>
              ))}
            </div>
          </div>
        )}

        {stats === undefined ? (
          <p className="text-muted">Loading…</p>
        ) : stats === null ? (
          <p className="rounded-lg border border-line bg-stone px-4 py-3 text-ink-soft">Visitor figures are not available here. They come from the live website and need administrator rights.</p>
        ) : (
          <>
            {beforeDaily && (
              <p className="rounded-lg border border-amber/50 bg-amber-tint px-4 py-2.5 text-[0.875rem]">Country figures by day start on {dateText(stats.dailySince!)}. Visits before then are included in “All time” only.</p>
            )}
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['Visitors', n(admin ? totalPeople : stats.total.people), 'people, counted once a day'],
                ['Visits', n(admin ? totalVisits : stats.total.visits), 'times the website was opened'],
                ['Countries', n(knownCountries), 'with at least one visit'],
                admin || period !== 'all'
                  ? ['Today', n(stats.today.people), 'people so far today']
                  : ['Report readers', n(reportReads), 'reads of human-rights reports and demonstration coverage'],
              ].map(([label, value, note]) => (
                <div key={label} className="rounded-xl border border-line bg-paper p-4">
                  <dt className="text-[0.8125rem] font-semibold tracking-wide text-ink-soft uppercase">{label}</dt>
                  <dd className="mt-1 font-serif text-[1.875rem] leading-none font-semibold tabular-nums">{value}</dd>
                  <dd className="mt-1 text-[0.8125rem] text-muted">{note}</dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
              <div className="min-w-0 space-y-5">
                <WorldMap data={rows} selected={selected} onSelect={setSelected} />
                <Trend days={stats.days} />
              </div>
              <div className="min-w-0">
                <h3 className="font-sans text-[1rem] font-semibold">By country</h3>
                <div className="mt-2"><CountryTable rows={rows} total={totalVisits} selected={selected} onSelect={setSelected} admin={admin} /></div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <RegionCard code="IQ-KR" title="Kurdistan Region" a={['Visitors', { people: kr?.people ?? 0, visits: null }]} b={['Visits', { people: kr?.visits ?? 0, visits: null }]}
                note="Erbil, Sulaymaniyah, Duhok and Halabja. Counted on its own, separately from the rest of Iraq, here and in the table." />
              {stats.iran && (
                <RegionCard code="IR" title="Iran and Eastern Kurdistan" a={['Kurdish provinces', stats.iran.kurdistan]} b={['Rest of Iran', stats.iran.rest]}
                  note="Kurdish provinces: Kurdistan, Kermanshah, Ilam and West Azerbaijan (approximate). Many people in Iran use VPNs, so their visits appear under other countries." />
              )}
              <div className="rounded-xl border border-line border-t-4 border-t-navy bg-surface p-4">
                <h4 className="font-sans text-[1rem] font-semibold">Members and visitors</h4>
                <dl className="mt-2 grid grid-cols-2 gap-3 text-[0.9375rem]">
                  <div><dt className="text-muted">Signed-in members</dt><dd className="text-[1.25rem] font-semibold tabular-nums">{n(stats.members.people)}</dd><dd className="text-[0.75rem] text-muted"><span className="tabular-nums">{n(stats.members.visits)}</span> visits</dd></div>
                  <div><dt className="text-muted">Visitors</dt><dd className="text-[1.25rem] font-semibold tabular-nums">{n(stats.visitors.people)}</dd><dd className="text-[0.75rem] text-muted"><span className="tabular-nums">{n(stats.visitors.visits)}</span> visits</dd></div>
                </dl>
              </div>
            </div>

            <p className="flex items-start gap-2 text-[0.8125rem] text-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden="true" />
              {admin
                ? 'Estimated locations, worked out by our hosting provider from each connection. VPNs, proxies, mobile networks and out-of-date address databases can place people in the wrong country. IP addresses are never stored; small numbers can still be sensitive, so do not share them outside the committee.'
                : 'Locations are estimates, worked out by our hosting provider from each connection, and VPNs or mobile networks can place people in another country. They never identify a person. We keep only totals by country, never store or show IP addresses, and list the Kurdistan Region on its own, separately from the rest of Iraq, so every figure adds up. Figures update automatically.'}
            </p>
          </>
        )}
      </div>
    </section>
  );
};
