import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Award as AwardIcon, CheckCircle2, Download, FileText, Loader2, Plus, Printer, RotateCcw, Search, Send, Trash2, XCircle } from 'lucide-react';
import { serverApi } from '../lib/memberApi';
import { Award, documentTitle, downloadLetter, drawLetter, printLetter } from '../lib/letter';
import { formatDate } from '../components/ui';
import { MediaImage } from '../components/MediaImage';
import { Initials } from '../components/PersonCard';

/**
 * Appreciation letters and certificates issued by administrators:
 * choose a member, category, achievement, reason, date and signatory;
 * preview; approve and issue; then download, print, correct or revoke.
 * Every document has its own number and verification address.
 */

export interface Category { id: string; label: string }
export interface MemberOption { id: string; fullName: string; displayName: string; memberNumber: string; position: string; council: string; photoUrl: string }
export interface Dashboard {
  awards: (Award & { historyCount?: number })[];
  categories: Category[];
  signatory: { name: string; title: string; signatureImage?: string };
  statement: string;
  members: MemberOption[];
  isAdmin: boolean;
}

const box = 'rounded-2xl border border-line bg-surface p-5 sm:p-6';
const field = 'mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 font-normal';
const label = 'block text-[0.9375rem] font-semibold';
const today = () => new Date().toISOString().slice(0, 10);

export const STATUS_LOOK: Record<Award['status'], { text: string; cls: string }> = {
  draft: { text: 'Draft', cls: 'bg-stone text-ink-soft' },
  pending: { text: 'Waiting for approval', cls: 'bg-amber-tint text-ink' },
  published: { text: 'Issued and valid', cls: 'bg-[#EAF6EF] text-[#1E6B47]' },
  revoked: { text: 'Revoked', cls: 'bg-crimson/10 text-crimson' },
  superseded: { text: 'Replaced', cls: 'bg-crimson/10 text-crimson' },
};

export const useCertificates = () => {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      setData(await serverApi<Dashboard>('appreciation/dashboard'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load.');
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload };
};

const Badge: React.FC<{ status: Award['status'] }> = ({ status }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold whitespace-nowrap ${STATUS_LOOK[status]?.cls || ''}`}>{STATUS_LOOK[status]?.text || status}</span>
);

const Preview: React.FC<{ award: Award }> = ({ award }) => {
  const [src, setSrc] = useState('');
  const key = JSON.stringify(award);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      drawLetter(award).then((c) => { if (alive) setSrc(c.toDataURL('image/jpeg', 0.8)); }).catch(() => setSrc(''));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return src
    ? <img src={src} alt={`Preview of the ${documentTitle(award).toLowerCase()} for ${award.name}`} className="w-full rounded-lg border border-line shadow-[0_18px_40px_-28px_rgba(0,0,0,0.6)]" />
    : <div className="flex aspect-[210/297] w-full items-center justify-center rounded-lg border border-line bg-paper text-muted"><Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /></div>;
};

// ---------------------------------------------------------------- overview

export const CertificateOverview: React.FC<{ data: Dashboard; onGo: (tab: string) => void; onOpen: (a: Award) => void }> = ({ data, onGo, onOpen }) => {
  const count = (s: Award['status']) => data.awards.filter((a) => a.status === s).length;
  const tiles: [string, number, string, React.ElementType][] = [
    ['Drafts', count('draft'), 'drafts', FileText],
    ['Waiting for approval', count('pending'), 'drafts', Send],
    ['Issued and valid', count('published'), 'issued', CheckCircle2],
    ['Revoked or replaced', count('revoked') + count('superseded'), 'withdrawn', XCircle],
  ];
  const recent = data.awards.filter((a) => a.status === 'published').slice(0, 8);
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([t, n, tab, Icon]) => (
          <button key={t} type="button" onClick={() => onGo(tab)} className="cursor-pointer rounded-2xl border border-line bg-surface p-4 text-start hover:border-navy">
            <Icon className="h-5 w-5 text-navy" aria-hidden="true" />
            <span className="mt-2 block text-[1.75rem] font-semibold tabular-nums">{n}</span>
            <span className="block text-[0.9375rem] text-ink-soft">{t}</span>
          </button>
        ))}
      </div>
      <section className={box}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[1.25rem] font-semibold">Recently issued</h3>
          <button type="button" onClick={() => onGo('new')} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-navy px-4 py-2 font-semibold text-white"><Plus className="h-4 w-4" aria-hidden="true" /> New letter or certificate</button>
        </div>
        {recent.length === 0 ? <p className="mt-3 text-muted">Nothing issued yet.</p> : <AwardRows awards={recent} onOpen={onOpen} />}
      </section>
      <section className={box}>
        <h3 className="text-[1.125rem] font-semibold">How it works</h3>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-ink-soft">
          <li>Choose an approved member, the category, the achievement and the reason.</li>
          <li>Choose the issue date and who signs it, and check the preview.</li>
          <li>Save it as a draft or, if you are an administrator, approve and issue it. Staff without administrator rights submit it for approval.</li>
          <li>Once issued it gets its own number and QR code, appears in the member’s account and history, and can be downloaded or printed.</li>
          <li>Issued documents are never changed. To correct one, issue a replacement; the old one then shows as replaced. To withdraw one, revoke it.</li>
        </ol>
      </section>
    </div>
  );
};

const AwardRows: React.FC<{ awards: Award[]; onOpen: (a: Award) => void }> = ({ awards, onOpen }) => (
  <ul className="mt-3 divide-y divide-line">
    {awards.map((a) => (
      <li key={a.id}>
        <button type="button" onClick={() => onOpen(a)} className="flex w-full cursor-pointer flex-col gap-1 py-2.5 text-start hover:bg-stone/50 sm:flex-row sm:items-center sm:gap-4">
          <span className="min-w-0 flex-1">
            <span className="font-semibold" dir="auto" data-i18n-skip="">{a.name}</span>
            <span className="block text-[0.875rem] text-muted">
              {a.number ? <span translate="no">{a.number} · </span> : null}
              {a.source === 'direct' ? `${a.categoryLabel} · ` : 'Activity · '}<span dir="auto">{a.achievement || a.activityTitle}</span>
              {' · '}{formatDate(a.issueDate || a.issuedAt || a.createdAt)}
            </span>
          </span>
          <Badge status={a.status} />
        </button>
      </li>
    ))}
  </ul>
);

// ---------------------------------------------------------------- new / edit

export const CertificateEditor: React.FC<{ data: Dashboard; editing?: Award | null; onDone: (msg: string) => void; onCancel?: () => void }> = ({ data, editing, onDone, onCancel }) => {
  const [memberId, setMemberId] = useState(editing?.uid || '');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'letter' | 'certificate'>(editing?.kind || 'certificate');
  const [category, setCategory] = useState(editing?.category || data.categories[0]?.id || '');
  const [achievement, setAchievement] = useState(editing?.achievement || '');
  const [reason, setReason] = useState(editing?.reason || data.statement || '');
  const [issueDate, setIssueDate] = useState(editing?.issueDate || today());
  const [signatoryName, setSignatoryName] = useState(editing?.signatoryName || data.signatory.name);
  const [signatoryTitle, setSignatoryTitle] = useState(editing?.signatoryTitle || data.signatory.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const member = data.members.find((m) => m.id === memberId);
  const cat = data.categories.find((c) => c.id === category);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.members.filter((m) => !t || `${m.fullName} ${m.displayName} ${m.memberNumber} ${m.council}`.toLowerCase().includes(t)).slice(0, 30);
  }, [q, data.members]);

  const preview: Award | null = member ? {
    id: editing?.id || 'preview', number: '', uid: member.id, name: member.fullName, activityId: '', activityTitle: achievement, activityDate: '',
    statement: reason, issuedAt: '', signatoryName, signatoryTitle, signatureImage: signatoryName === data.signatory.name ? data.signatory.signatureImage : '',
    verifyUrl: `https://mashkhall.com/appreciation/${editing?.id || 'XXXXXXXXXXXXXXXXXXXXXX'}`, status: 'draft', source: 'direct', kind,
    category, categoryLabel: cat?.label, achievement, reason, issueDate, memberNumber: member.memberNumber, positionTitle: member.position, councilName: member.council,
  } : null;

  const save = async (then: 'draft' | 'submit' | 'issue') => {
    setError('');
    setBusy(true);
    try {
      const { award } = await serverApi<{ award: Award }>('appreciation/save', { id: editing?.id, memberId, kind, category, achievement, reason, issueDate, signatoryName, signatoryTitle });
      if (then === 'submit') await serverApi('appreciation/submit', { id: award.id });
      if (then === 'issue') {
        const r = await serverApi<{ award: Award }>('appreciation/issue', { id: award.id });
        onDone(`Issued ${r.award.number} to ${r.award.name}. It is now in their account and can be checked with its QR code.`);
        return;
      }
      onDone(then === 'submit' ? `Sent for approval: ${documentTitle({ kind })} for ${member?.fullName}.` : `Draft saved for ${member?.fullName}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not saved.');
    } finally {
      setBusy(false);
    }
  };

  const ready = Boolean(member && cat && achievement.trim().length >= 3 && reason.trim().length >= 10 && signatoryName.trim());

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="space-y-5">
        <section className={box}>
          <h3 className="text-[1.125rem] font-semibold">1. Member</h3>
          {member ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-stone p-3">
              {member.photoUrl ? <MediaImage src={member.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="overflow-hidden rounded-full"><Initials name={member.fullName} size={48} /></span>}
              <span className="min-w-0 flex-1"><span className="block font-semibold" dir="auto">{member.fullName}</span><span className="block text-[0.875rem] text-muted">{[member.memberNumber, member.position, member.council && `${member.council} Council`].filter(Boolean).join(' · ')}</span></span>
              {!editing && <button type="button" onClick={() => setMemberId('')} className="cursor-pointer font-semibold text-navy">Change</button>}
            </div>
          ) : (
            <>
              <label className="relative mt-3 block">
                <span className="sr-only">Search members</span>
                <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, membership number or council" className="w-full rounded-lg border border-line bg-paper py-2 pe-3 ps-9" />
              </label>
              <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {matches.map((m) => (
                  <li key={m.id}><button type="button" onClick={() => setMemberId(m.id)} className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-start hover:bg-stone">
                    <span className="min-w-0 flex-1"><span className="block font-semibold" dir="auto">{m.fullName}</span><span className="block text-[0.8125rem] text-muted">{[m.memberNumber, m.position, m.council].filter(Boolean).join(' · ')}</span></span>
                  </button></li>
                ))}
                {!matches.length && <li className="p-3 text-muted">No active member matches.</li>}
              </ul>
              <p className="mt-2 text-[0.8125rem] text-muted">Only members with an active membership are listed.</p>
            </>
          )}
        </section>

        <section className={`${box} space-y-4`}>
          <h3 className="text-[1.125rem] font-semibold">2. What is being recognised</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>Document
              <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={field}>
                <option value="certificate">Certificate of Appreciation</option>
                <option value="letter">Letter of Appreciation</option>
              </select>
            </label>
            <label className={label}>Category
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
                {data.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
          </div>
          <label className={label}>Achievement (shown as the main line)
            <input value={achievement} maxLength={200} onChange={(e) => setAchievement(e.target.value)} className={field} placeholder="For example: Photography of the 17 February 2026 commemoration" dir="auto" />
          </label>
          <label className={label}>Reason for the appreciation
            <textarea value={reason} maxLength={1200} rows={4} onChange={(e) => setReason(e.target.value)} className={field} placeholder="In recognition of…" dir="auto" />
          </label>
        </section>

        <section className={`${box} space-y-4`}>
          <h3 className="text-[1.125rem] font-semibold">3. Date and signatory</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={label}>Issue date<input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={field} /></label>
            <label className={label}>Signed by<input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} className={field} dir="auto" /></label>
            <label className={label}>Signatory’s position<input value={signatoryTitle} onChange={(e) => setSignatoryTitle(e.target.value)} className={field} /></label>
          </div>
          <p className="text-[0.8125rem] text-muted">The saved signature image is used only when the default signatory ({data.signatory.name || 'not set'}) signs.</p>
        </section>

        {error && <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson/5 px-4 py-3 text-crimson">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {onCancel && <button type="button" onClick={onCancel} className="cursor-pointer rounded-lg px-4 py-2 font-semibold text-ink-soft hover:bg-stone">Cancel</button>}
          <button type="button" disabled={busy || !ready} onClick={() => save('draft')} className="cursor-pointer rounded-lg border border-line px-4 py-2 font-semibold disabled:opacity-50">Save draft</button>
          {data.isAdmin ? (
            <button type="button" disabled={busy || !ready} onClick={() => { if (window.confirm(`Approve and issue this ${documentTitle({ kind }).toLowerCase()} to ${member?.fullName}? It gets a permanent number and can no longer be edited.`)) save('issue'); }} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-navy px-5 py-2 font-semibold text-white disabled:opacity-50">
              <AwardIcon className="h-4 w-4" aria-hidden="true" /> {busy ? 'Working…' : 'Approve and issue'}
            </button>
          ) : (
            <button type="button" disabled={busy || !ready} onClick={() => save('submit')} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-navy px-5 py-2 font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" aria-hidden="true" /> Submit for approval</button>
          )}
        </div>
      </div>
      <aside className="space-y-2 xl:sticky xl:top-4 xl:self-start">
        <h3 className="text-[1.125rem] font-semibold">Preview</h3>
        {preview ? <Preview award={preview} /> : <div className="flex aspect-[210/297] w-full items-center justify-center rounded-lg border border-dashed border-line text-center text-muted">Choose a member to see the preview</div>}
        <p className="text-[0.8125rem] text-muted">The number and QR code are created when it is issued. The member’s current verified name is fixed on it at that moment.</p>
      </aside>
    </div>
  );
};

// ---------------------------------------------------------------- lists

export const CertificateList: React.FC<{ data: Dashboard; statuses: Award['status'][]; title: string; empty: string; onOpen: (a: Award) => void }> = ({ data, statuses, title, empty, onOpen }) => {
  const [q, setQ] = useState('');
  const list = data.awards.filter((a) => statuses.includes(a.status))
    .filter((a) => !q.trim() || `${a.name} ${a.number} ${a.memberNumber || ''} ${a.achievement || a.activityTitle} ${a.categoryLabel || ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <section className={box}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[1.25rem] font-semibold">{title} ({list.length})</h3>
        <label className="relative">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Member or certificate number" className="rounded-lg border border-line bg-paper py-2 pe-3 ps-9" />
        </label>
      </div>
      {list.length ? <AwardRows awards={list} onOpen={onOpen} /> : <p className="mt-3 text-muted">{empty}</p>}
    </section>
  );
};

export const MemberAppreciation: React.FC<{ data: Dashboard; onOpen: (a: Award) => void }> = ({ data, onOpen }) => {
  const [q, setQ] = useState('');
  const [memberId, setMemberId] = useState('');
  const names = useMemo(() => {
    const map = new Map<string, string>();
    data.members.forEach((m) => map.set(m.id, m.fullName));
    data.awards.forEach((a) => { if (!map.has(a.uid)) map.set(a.uid, a.name); });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);
  const shown = names.filter(([, n]) => !q.trim() || n.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40);
  const awards = data.awards.filter((a) => a.uid === memberId);
  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <section className={box}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a member" className="w-full rounded-lg border border-line bg-paper px-3 py-2" />
        <ul className="mt-2 max-h-[28rem] overflow-y-auto">
          {shown.map(([id, n]) => (
            <li key={id}><button type="button" aria-pressed={memberId === id} onClick={() => setMemberId(id)} className={`w-full cursor-pointer rounded-lg px-3 py-2 text-start ${memberId === id ? 'bg-navy text-white' : 'hover:bg-stone'}`} dir="auto">{n} <span className="text-[0.8125rem] opacity-70">({data.awards.filter((a) => a.uid === id).length})</span></button></li>
          ))}
        </ul>
      </section>
      <section className={box}>
        {!memberId ? <p className="text-muted">Choose a member to see every letter and certificate they have received, including revoked and replaced ones.</p> : (
          <>
            <h3 className="text-[1.25rem] font-semibold" dir="auto">{names.find(([id]) => id === memberId)?.[1]}</h3>
            {awards.length ? <AwardRows awards={awards} onOpen={onOpen} /> : <p className="mt-3 text-muted">No appreciation yet.</p>}
          </>
        )}
      </section>
    </div>
  );
};

export const CategoriesEditor: React.FC<{ data: Dashboard; onSaved: (msg: string) => void }> = ({ data, onSaved }) => {
  const [list, setList] = useState<Category[]>(data.categories);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await serverApi<{ categories: Category[] }>('appreciation/categories', { categories: list });
      setList(r.categories);
      onSaved('Categories saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Not saved.'); } finally { setBusy(false); }
  };
  return (
    <section className={box}>
      <h3 className="text-[1.25rem] font-semibold">Appreciation categories</h3>
      <p className="mt-1 text-ink-soft">Renaming a category changes it for new letters only; issued letters keep the wording they were issued with.</p>
      <ul className="mt-4 space-y-2">
        {list.map((c, i) => (
          <li key={i} className="flex gap-2">
            <input value={c.label} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="flex-1 rounded-lg border border-line bg-paper px-3 py-2" aria-label={`Category ${i + 1}`} />
            <button type="button" onClick={() => setList(list.filter((_, j) => j !== i))} className="cursor-pointer rounded-lg px-3 text-crimson hover:bg-crimson/5" aria-label={`Remove ${c.label}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap justify-between gap-2">
        <button type="button" onClick={() => setList([...list, { id: '', label: '' }])} className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-navy"><Plus className="h-4 w-4" aria-hidden="true" /> Add a category</button>
        <button type="button" disabled={busy || !data.isAdmin} onClick={save} className="cursor-pointer rounded-lg bg-navy px-5 py-2 font-semibold text-white disabled:opacity-50">Save categories</button>
      </div>
      {error && <p role="alert" className="mt-3 text-crimson">{error}</p>}
    </section>
  );
};

// ---------------------------------------------------------------- one document

export const CertificateDrawer: React.FC<{ award: Award; data: Dashboard; onClose: () => void; onChanged: (msg: string) => void }> = ({ award, data, onClose, onChanged }) => {
  const [mode, setMode] = useState<'view' | 'edit' | 'replace' | 'revoke'>('view');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [fix, setFix] = useState({ achievement: award.achievement || award.activityTitle, reason: award.reason || award.statement, category: award.category || data.categories[0]?.id, kind: award.kind || 'letter' });
  const editable = award.status === 'draft' || award.status === 'pending';
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    setError('');
    try { await fn(); onChanged(msg); } catch (e) { setError(e instanceof Error ? e.message : 'That did not work.'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-ink/55" role="dialog" aria-modal="true" aria-labelledby="cert-title">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-surface">
        <header className="flex items-start gap-4 border-b border-line p-5">
          <div className="min-w-0 flex-1">
            <h2 id="cert-title" className="text-[1.375rem] font-semibold">{documentTitle(award)} · <span dir="auto">{award.name}</span></h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.9375rem] text-ink-soft"><Badge status={award.status} />{award.number && <span translate="no">{award.number}</span>}{award.categoryLabel && <span>· {award.categoryLabel}</span>}</p>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-full p-1.5 hover:bg-stone" aria-label="Close"><XCircle className="h-5 w-5" aria-hidden="true" /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          {mode === 'edit' ? (
            <CertificateEditor data={data} editing={award} onDone={onChanged} onCancel={() => setMode('view')} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <Preview award={award} />
              <aside className="space-y-4">
                {error && <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson/5 px-3 py-2 text-crimson">{error}</p>}
                {award.status === 'superseded' && <p className="rounded-lg bg-stone px-3 py-2">Replaced by <span translate="no">{award.supersededByNumber}</span>{award.correction ? `: ${award.correction}` : ''}.</p>}
                {award.status === 'revoked' && <p className="rounded-lg bg-crimson/5 px-3 py-2 text-crimson">Revoked {formatDate(award.revokedAt)}: {award.revokedReason}</p>}
                {award.replacesNumber && <p className="text-[0.9375rem]">Replaces <span translate="no">{award.replacesNumber}</span>.</p>}

                {mode === 'view' && (
                  <div className="grid gap-2">
                    {editable && <button type="button" onClick={() => setMode('edit')} className="cursor-pointer rounded-lg border border-line px-4 py-2 font-semibold">Edit</button>}
                    {editable && data.isAdmin && <button type="button" disabled={busy} onClick={() => window.confirm('Approve and issue it now? It gets a permanent number and can no longer be edited.') && act(() => serverApi('appreciation/issue', { id: award.id }), 'Issued.')} className="cursor-pointer rounded-lg bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50">Approve and issue</button>}
                    {award.status === 'draft' && !data.isAdmin && <button type="button" disabled={busy} onClick={() => act(() => serverApi('appreciation/submit', { id: award.id }), 'Sent for approval.')} className="cursor-pointer rounded-lg bg-navy px-4 py-2 font-semibold text-white">Submit for approval</button>}
                    {editable && <button type="button" disabled={busy} onClick={() => window.confirm('Delete this draft?') && act(() => serverApi('appreciation/discard', { id: award.id }), 'Draft deleted.')} className="cursor-pointer rounded-lg px-4 py-2 font-semibold text-crimson hover:bg-crimson/5">Delete draft</button>}
                    {award.status === 'published' && (
                      <>
                        <button type="button" onClick={() => downloadLetter(award)} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-navy px-4 py-2 font-semibold text-white"><Download className="h-4 w-4" aria-hidden="true" /> Download PDF</button>
                        <button type="button" onClick={() => printLetter(award)} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line px-4 py-2 font-semibold"><Printer className="h-4 w-4" aria-hidden="true" /> Print</button>
                        <a href={`/appreciation/${award.id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-4 py-2 text-center font-semibold no-underline">Open its verification page</a>
                        {data.isAdmin && <button type="button" onClick={() => setMode('replace')} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line px-4 py-2 font-semibold"><RotateCcw className="h-4 w-4" aria-hidden="true" /> Correct and reissue</button>}
                        {data.isAdmin && <button type="button" onClick={() => setMode('revoke')} className="cursor-pointer rounded-lg px-4 py-2 font-semibold text-crimson hover:bg-crimson/5">Revoke</button>}
                      </>
                    )}
                  </div>
                )}

                {mode === 'revoke' && (
                  <div className="space-y-3">
                    <p>Its verification page will say it has been revoked. The record stays in the member’s history.</p>
                    <label className={label}>Reason (required)<input value={reason} onChange={(e) => setReason(e.target.value)} className={field} /></label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setMode('view')} className="cursor-pointer rounded-lg px-4 py-2 font-semibold text-ink-soft">Cancel</button>
                      <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => act(() => serverApi('appreciation/revoke', { id: award.id, reason }), `${award.number} revoked.`)} className="cursor-pointer rounded-lg bg-crimson px-4 py-2 font-semibold text-white disabled:opacity-50">Revoke</button>
                    </div>
                  </div>
                )}

                {mode === 'replace' && (
                  <div className="space-y-3">
                    <p>A corrected copy is issued with a new number and QR code. This one stays on record and its page will point to the new one. The member’s current verified name is used.</p>
                    <label className={label}>Document
                      <select value={fix.kind} onChange={(e) => setFix({ ...fix, kind: e.target.value as 'letter' | 'certificate' })} className={field}><option value="certificate">Certificate of Appreciation</option><option value="letter">Letter of Appreciation</option></select>
                    </label>
                    <label className={label}>Category
                      <select value={fix.category} onChange={(e) => setFix({ ...fix, category: e.target.value })} className={field}>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
                    </label>
                    <label className={label}>Achievement<input value={fix.achievement} onChange={(e) => setFix({ ...fix, achievement: e.target.value })} className={field} dir="auto" /></label>
                    <label className={label}>Reason<textarea rows={4} value={fix.reason} onChange={(e) => setFix({ ...fix, reason: e.target.value })} className={field} dir="auto" /></label>
                    <label className={label}>What is being corrected (required, kept on record)<input value={reason} onChange={(e) => setReason(e.target.value)} className={field} /></label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setMode('view')} className="cursor-pointer rounded-lg px-4 py-2 font-semibold text-ink-soft">Cancel</button>
                      <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => act(() => serverApi('appreciation/replace', { id: award.id, correction: reason, ...fix }), 'Replacement issued; the original now shows as replaced.')} className="cursor-pointer rounded-lg bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50">Issue the replacement</button>
                    </div>
                  </div>
                )}

                <dl className="space-y-1 border-t border-line pt-3 text-[0.9375rem]">
                  {award.memberNumber && <div><dt className="inline font-semibold">Member: </dt><dd className="inline" translate="no">{award.memberNumber}</dd></div>}
                  <div><dt className="inline font-semibold">Signed by: </dt><dd className="inline">{award.signatoryName}, {award.signatoryTitle}</dd></div>
                  {award.createdByName && <div><dt className="inline font-semibold">Prepared by: </dt><dd className="inline">{award.createdByName}</dd></div>}
                  {award.approvedByName && <div><dt className="inline font-semibold">Approved by: </dt><dd className="inline">{award.approvedByName}</dd></div>}
                </dl>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
