import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, limit, onSnapshot, query, where } from 'firebase/firestore';
import { Award as AwardIcon, BadgeCheck, Download, Loader2, Printer, Search, ShieldAlert } from 'lucide-react';
import { db } from '../firebase';
import { Button, Container, EmptyState, PageHeader } from '../components/ui';
import { MediaImage } from '../components/MediaImage';
import { useData } from '../context/DataContext';
import { Award, documentTitle, downloadLetter, drawLetter, printLetter } from '../lib/letter';

/**
 * Appreciation: public recognition of members who took part in the
 * organisation's official activities. Only awards approved by an
 * administrator appear; each has a letter that anyone can check.
 */

const longDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }) : '');

const LetterPreview: React.FC<{ award: Award }> = ({ award }) => {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    drawLetter(award).then((c) => { if (alive) setSrc(c.toDataURL('image/jpeg', 0.82)); }).catch(() => setSrc(''));
    return () => { alive = false; };
  }, [award]);
  return src ? <img src={src} alt={`${documentTitle(award)} ${award.number} for ${award.name}`} className="w-full rounded-lg border border-line shadow-[0_18px_40px_-28px_rgba(0,0,0,0.6)]" />
    : <div className="flex aspect-[210/297] w-full items-center justify-center rounded-lg border border-line bg-paper text-muted"><Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /></div>;
};

const AwardDetail: React.FC<{ id: string }> = ({ id }) => {
  const [award, setAward] = useState<Award | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getDoc(doc(db, 'appreciation_awards', id)).then((s) => setAward(s.exists() ? (s.data() as Award) : null)).catch(() => setAward(null));
  }, [id]);
  if (award === undefined) return <Container className="py-12"><p className="flex items-center gap-2 text-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Checking…</p></Container>;
  if (award === null) {
    return (
      <>
        <PageHeader title="Letter not found" kicker={<a href="/appreciation">Appreciation</a>} />
        <Container className="py-12"><EmptyState title="We have no record of this letter" body="Check the address or the number on the letter. If you believe a letter is genuine, contact us." /></Container>
      </>
    );
  }
  const revoked = award.status === 'revoked';
  const replaced = award.status === 'superseded';
  const invalid = revoked || replaced;
  const noun = award.kind === 'certificate' ? 'certificate' : 'letter';
  return (
    <>
      <PageHeader title={award.name} kicker={<a href="/appreciation">Appreciation</a>} intro={award.source === 'direct'
        ? <>{documentTitle(award)}: {award.categoryLabel}, <span dir="auto">{award.achievement}</span></>
        : <>For taking part in <span dir="auto">{award.activityTitle}</span>{award.activityDate ? `, ${longDate(award.activityDate)}` : ''}</>} />
      <Container className="grid gap-8 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_360px]">
        <LetterPreview award={award} />
        <aside className="space-y-4">
          <div className={`rounded-2xl border p-5 ${invalid ? 'border-crimson bg-[#FBEDEF]' : 'border-[#2FA36B]/50 bg-[#EAF6EF]'}`} role="status">
            {replaced ? (
              <>
                <p className="flex items-center gap-2 font-semibold text-crimson"><ShieldAlert className="h-5 w-5" aria-hidden="true" /> Genuine, but replaced</p>
                <p className="mt-2 text-ink-soft">This {noun} was issued by the organisation, then replaced by a corrected one on {longDate(award.supersededAt || '')}. This copy is no longer valid.</p>
                {award.supersededBy && <a href={`/appreciation/${award.supersededBy}`} className="mt-2 inline-block font-semibold text-navy">See the current {noun} ({award.supersededByNumber})</a>}
              </>
            ) : revoked ? (
              <>
                <p className="flex items-center gap-2 font-semibold text-crimson"><ShieldAlert className="h-5 w-5" aria-hidden="true" /> This {noun} has been revoked</p>
                <p className="mt-2 text-ink-soft">Revoked on {longDate(award.revokedAt || '')}. It is no longer valid.</p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 font-semibold text-[#1E6B47]"><BadgeCheck className="h-5 w-5" aria-hidden="true" /> Genuine and valid</p>
                <p className="mt-2 text-ink-soft">Issued by Mashkhally Zhyanawa Organisation on {longDate(award.issueDate || award.issuedAt)}.</p>
              </>
            )}
            <dl className="mt-3 space-y-1 text-[0.9375rem]">
              <div><dt className="inline font-semibold">Number: </dt><dd className="inline" translate="no">{award.number}</dd></div>
              {award.categoryLabel && <div><dt className="inline font-semibold">Category: </dt><dd className="inline">{award.categoryLabel}</dd></div>}
              {award.councilName && <div><dt className="inline font-semibold">Council: </dt><dd className="inline">{award.councilName}</dd></div>}
              {award.replacesNumber && <div><dt className="inline font-semibold">Replaces: </dt><dd className="inline" translate="no">{award.replacesNumber}</dd></div>}
              <div><dt className="inline font-semibold">Signed by: </dt><dd className="inline">{award.signatoryName}, {award.signatoryTitle}</dd></div>
            </dl>
          </div>
          {!invalid && (
            <div className="grid gap-2">
              <Button size="lg" className="w-full" disabled={busy} onClick={async () => { setBusy(true); try { await downloadLetter(award); } finally { setBusy(false); } }}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Download className="h-5 w-5" aria-hidden="true" />} Download the {noun} (PDF)
              </Button>
              <Button variant="secondary" className="w-full" disabled={busy} onClick={() => printLetter(award)}><Printer className="h-4 w-4" aria-hidden="true" /> Print</Button>
            </div>
          )}
          <p className="text-[0.875rem] text-muted">The QR code on each letter and certificate opens this page, so anyone can check that it is genuine and still valid.</p>
        </aside>
      </Container>
    </>
  );
};

const Gallery: React.FC = () => {
  const { chapters } = useData();
  const [awards, setAwards] = useState<Award[] | null>(null);
  const [q, setQ] = useState('');
  const [activity, setActivity] = useState('');
  const [council, setCouncil] = useState('');
  const [year, setYear] = useState('');
  useEffect(() => onSnapshot(
    query(collection(db, 'appreciation_awards'), where('status', '==', 'published'), limit(1000)),
    (s) => setAwards(s.docs.map((d) => d.data() as Award).sort((a, b) => (b.activityDate || b.issuedAt).localeCompare(a.activityDate || a.issuedAt))),
    () => setAwards([]),
  ), []);
  const activities = useMemo(() => [...new Map((awards || []).map((a) => [a.activityId, a.activityTitle])).entries()], [awards]);
  const years = useMemo(() => [...new Set((awards || []).map((a) => (a.activityDate || a.issuedAt).slice(0, 4)))].sort().reverse(), [awards]);
  const shown = (awards || []).filter((a) => (!q || a.name.toLowerCase().includes(q.toLowerCase()) || a.number.toLowerCase().includes(q.toLowerCase()))
    && (!activity || a.activityId === activity) && (!council || a.councilId === council) && (!year || (a.activityDate || a.issuedAt).startsWith(year)));
  const select = 'rounded-lg border border-line bg-surface px-3 py-2';
  return (
    <>
      <PageHeader title="Appreciation" intro="We thank the members who give their time to the organisation’s activities. Each person listed here took part in an official activity, confirmed by their council and approved by the organisation." />
      <Container className="py-10 sm:py-14">
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative block">
            <span className="sr-only">Search by name or letter number</span>
            <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or letter number" className={`${select} w-full ps-9`} />
          </label>
          <select aria-label="Activity" value={activity} onChange={(e) => setActivity(e.target.value)} className={select}><option value="">All activities</option>{activities.map(([id, t]) => <option key={id} value={id}>{t}</option>)}</select>
          <select aria-label="Council" value={council} onChange={(e) => setCouncil(e.target.value)} className={select}><option value="">All councils</option>{chapters.filter((c) => !c.isArchived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select aria-label="Year" value={year} onChange={(e) => setYear(e.target.value)} className={select}><option value="">All years</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        </div>
        {awards === null ? <p className="flex items-center gap-2 text-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading…</p>
          : !shown.length ? <EmptyState title={awards.length ? 'No one matches your search' : 'No appreciation letters yet'} body={awards.length ? 'Try another name, activity or year.' : 'Letters appear here once an activity’s participants have been approved.'} />
            : (
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((a) => (
                  <li key={a.id}>
                    <a href={`/appreciation/${a.id}`} className="group flex h-full gap-4 rounded-2xl border border-line bg-surface p-5 no-underline hover:border-navy">
                      {a.photoUrl ? <MediaImage src={a.photoUrl} alt="" className="h-20 w-20 shrink-0 rounded-full object-cover" />
                        : <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-navy-tint text-navy"><AwardIcon className="h-8 w-8" aria-hidden="true" /></span>}
                      <span className="min-w-0">
                        <span className="block text-[1.1875rem] font-semibold text-ink group-hover:underline" dir="auto" data-i18n-skip="">{a.name}</span>
                        <span className="mt-1 block text-[0.9375rem] text-ink-soft" dir="auto">{a.activityTitle}</span>
                        <span className="mt-1 block text-[0.875rem] text-muted">{longDate(a.activityDate || a.issuedAt)}{a.councilName ? ` · ${a.councilName}` : ''}</span>
                        <span className="mt-2 inline-flex items-center gap-1 text-[0.875rem] font-semibold text-navy"><Download className="h-4 w-4" aria-hidden="true" /> View and download the letter</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
      </Container>
    </>
  );
};

export const AppreciationPage: React.FC<{ param?: string }> = ({ param }) => {
  const id = (param || '').split('?')[0].split('/')[0];
  return id ? <AwardDetail key={id} id={id} /> : <Gallery />;
};

export default AppreciationPage;
