import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useData } from '../context/DataContext';
import { ArticleComment, ContentReport } from '../types';
import {
  commentLink, rulesAreCurrent, deleteComment, deleteReport, loadAllComments, loadOpenReports, resolveReport, setCommentHidden,
} from '../lib/comments';
import { formatEventDate, useNewsBanners } from '../lib/newsBanner';

type View = 'reports' | 'all' | 'hidden';

/**
 * Comment moderation for administrators and moderators (content reviewers
 * and publishers): reported comments, every recent comment, and the
 * settings for who may comment.
 */
export const CommentsAdmin: React.FC = () => {
  const { articles, siteSettings, updateSiteSettings } = useData();
  const { banners } = useNewsBanners(true);
  const [view, setView] = useState<View>('reports');
  const [reports, setReports] = useState<ContentReport[] | null>(null);
  const [comments, setComments] = useState<ArticleComment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const [r, c] = await Promise.all([loadOpenReports(), loadAllComments()]);
      setReports(r);
      setComments(c);
    } catch (e) {
      console.error(e);
      setMsg({ ok: false, text: 'Comments could not be loaded. Check that the latest database rules are published.' });
      setReports([]);
      setComments([]);
    }
  };
  const [rulesOk, setRulesOk] = useState(true);
  useEffect(() => { load(); rulesAreCurrent().then(setRulesOk); }, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); await load(); } catch (e) {
      console.error(e);
      setMsg({ ok: false, text: 'That did not work. Please try again.' });
    } finally { setBusy(false); }
  };

  const titleOf = (type: string, id: string) =>
    type === 'article' ? articles.find((a) => a.id === id)?.title || 'Article' : banners.find((b) => b.id === id)?.message || 'Activity';
  const linkOf = (type: 'article' | 'activity', id: string) =>
    commentLink({ parentType: type, parentId: id }, type === 'article' ? articles.find((a) => a.id === id)?.slug : undefined);
  const byId = useMemo(() => new Map((comments || []).map((c) => [c.id, c])), [comments]);

  const shown = (comments || [])
    .filter((c) => (view === 'hidden' ? c.status === 'hidden' : true))
    .filter((c) => !search.trim() || `${c.authorName} ${c.text}`.toLowerCase().includes(search.trim().toLowerCase()));

  const visitorsAllowed = siteSettings.interactions?.commentsMembersOnly !== true;
  const enabled = siteSettings.interactions?.commentsEnabled !== false;
  const setInteractions = (patch: Partial<NonNullable<typeof siteSettings.interactions>>) =>
    run(() => updateSiteSettings({
      interactions: {
        commentsEnabled: enabled, commentsMembersOnly: !visitorsAllowed, reactionsEnabled: siteSettings.interactions?.reactionsEnabled !== false, ...patch,
      },
    }), 'Comment settings saved.');

  const parentOf = (c: ArticleComment) => ({ type: c.parentType, id: c.parentId });
  const repliesTo = (c: ArticleComment) => (comments || []).filter((x) => x.replyTo === c.id && x.parentId === c.parentId).map((x) => x.id);

  const tab = (v: View, label: string) => (
    <button type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-[0.875rem] font-semibold ${view === v ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'}`}>{label}</button>
  );

  const Actions: React.FC<{ c: ArticleComment }> = ({ c }) => (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => run(() => setCommentHidden(parentOf(c), c.id, c.status !== 'hidden'), c.status === 'hidden' ? 'Comment shown again.' : 'Comment hidden. Only moderators and its author can see it.')} className="cursor-pointer rounded-lg border border-line px-3 py-1 text-[0.875rem] font-semibold hover:border-ink/40 disabled:opacity-50">{c.status === 'hidden' ? 'Show' : 'Hide'}</button>
      <button type="button" disabled={busy} onClick={() => { if (window.confirm('Delete this comment (and its replies)? This cannot be undone.')) run(() => deleteComment(parentOf(c), c.id, repliesTo(c)), 'Comment deleted.'); }} className="cursor-pointer rounded-lg border border-line px-3 py-1 text-[0.875rem] font-semibold hover:border-crimson hover:text-crimson disabled:opacity-50">Delete</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[1.5rem] font-semibold">Comments</h2>
        <p className="mt-1 max-w-[75ch] text-ink-soft">Members and visitors can comment on articles, videos and activities. Comments are shown as plain text. Visitors can comment once a minute and cannot post links; members every 20 seconds. Anyone can report a comment.</p>
      </div>

      {!rulesOk && (
        <p role="alert" className="rounded-2xl border-2 border-crimson bg-crimson/5 p-4 text-[0.9375rem]">
          <strong className="text-crimson">Comments can’t be posted yet.</strong> The database is still using the previous rules. In the Firebase console open Firestore Database → Rules, replace everything with the latest firestore.rules file, and press Publish. Comments and the organisation chart start working within a minute.
        </p>
      )}

      <section className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={enabled} disabled={busy} onChange={(e) => setInteractions({ commentsEnabled: e.target.checked })} className="mt-1 h-4 w-4" />
          <span><strong>Comments are open</strong><span className="block text-[0.875rem] text-muted">Turn off to close every comment section.</span></span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={visitorsAllowed} disabled={busy || !enabled} onChange={(e) => setInteractions({ commentsMembersOnly: !e.target.checked })} className="mt-1 h-4 w-4" />
          <span><strong>Visitors can comment without an account</strong><span className="block text-[0.875rem] text-muted">Needs “Anonymous” sign-in switched on in Firebase. Turn off if there is spam.</span></span>
        </label>
      </section>

      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 text-[0.9375rem] ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}

      <div role="tablist" aria-label="Comments" className="flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1 sm:w-fit">
        {tab('reports', `Reported (${reports?.length ?? '…'})`)}
        {tab('all', `All comments (${comments?.length ?? '…'})`)}
        {tab('hidden', `Hidden (${comments ? comments.filter((c) => c.status === 'hidden').length : '…'})`)}
      </div>

      {view === 'reports' ? (
        reports === null ? <p className="text-muted">Loading…</p> : reports.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">No reported comments.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {reports.map((r) => {
              const c = r.commentId ? byId.get(r.commentId) : undefined;
              const type = r.parentType || 'article';
              return (
                <li key={r.id} className="space-y-2 p-4">
                  <p className="text-[0.875rem] text-muted">Reported {formatEventDate(r.createdAt)} · <strong className="text-crimson">{r.reason}</strong></p>
                  <blockquote dir="auto" className="rounded-xl bg-stone p-3 whitespace-pre-wrap">{c?.text || r.commentText || '(comment already removed)'}<footer className="mt-1 text-[0.875rem] text-muted">— {c?.authorName || r.commentAuthor}{c?.visitor ? ' (visitor)' : ''}{c?.status === 'hidden' ? ' · hidden' : ''}</footer></blockquote>
                  <a href={linkOf(type, r.articleId)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[0.9375rem] font-semibold text-navy underline">{titleOf(type, r.articleId)} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
                  <div className="flex flex-wrap gap-2">
                    {c && <Actions c={c} />}
                    <button type="button" disabled={busy} onClick={() => run(() => resolveReport(r.id), 'Report closed.')} className="cursor-pointer rounded-lg bg-navy px-3 py-1 text-[0.875rem] font-semibold text-white disabled:opacity-50">{c ? 'Keep comment, close report' : 'Close report'}</button>
                    <button type="button" disabled={busy} onClick={() => run(() => deleteReport(r.id), 'Report deleted.')} className="cursor-pointer px-2 py-1 text-[0.875rem] font-semibold text-muted underline">Delete report</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search comments or names" aria-label="Search comments" className="w-full rounded-lg border border-line bg-surface px-3 py-2 sm:max-w-sm" />
          {comments === null ? <p className="text-muted">Loading…</p> : shown.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">No comments.</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {shown.slice(0, 300).map((c) => (
                <li key={`${c.parentId}-${c.id}`} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-[0.875rem] text-muted"><strong className="text-ink">{c.authorName}</strong> {c.visitor ? '(visitor)' : '(member)'} · {formatEventDate(c.createdAt)}{c.status === 'hidden' ? ' · hidden' : ''}{c.replyTo ? ' · reply' : ''}</p>
                    <p dir="auto" className="mt-1 break-words whitespace-pre-wrap">{c.text}</p>
                    <a href={linkOf(c.parentType, c.parentId)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[0.875rem] font-semibold text-navy underline">{titleOf(c.parentType, c.parentId)} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
                  </div>
                  <div className="shrink-0"><Actions c={c} /></div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};
