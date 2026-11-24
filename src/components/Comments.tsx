import React, { useMemo, useRef, useState } from 'react';
import { Flag, MessageSquare, Reply, Trash2, EyeOff, Pencil } from 'lucide-react';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ArticleComment } from '../types';
import {
  CommentParent, deleteComment, editComment, postComment, reportComment, setCommentHidden, useComments, validateComment,
} from '../lib/comments';
import { Initials } from './PersonCard';
import { MediaImage } from './MediaImage';

const REASONS = ['Spam or advertising', 'Abusive, hateful or threatening', 'Shares someone’s personal information', 'False or misleading', 'Something else'];
const NAME_KEY = '17shubat_visitor_name';

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Comment form: members comment as themselves; visitors give a name. */
const CommentForm: React.FC<{
  parent: CommentParent;
  replyTo?: string;
  onDone?: () => void;
  autoFocus?: boolean;
  compact?: boolean;
}> = ({ parent, replyTo, onDone, autoFocus, compact }) => {
  const { currentUser, userProfile } = useAuth();
  const { publicProfiles, siteSettings } = useData();
  const member = Boolean(currentUser);
  const profile = currentUser ? publicProfiles.find((p) => p.id === currentUser.uid) : undefined;
  const memberName = profile?.displayName || userProfile?.displayName || currentUser?.displayName || (currentUser?.email || '').split('@')[0] || 'Member';
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } });
  const [text, setText] = useState('');
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const openedAt = useRef(Date.now());
  const visitorsAllowed = siteSettings.interactions?.commentsMembersOnly !== true;

  if (!member && !visitorsAllowed) {
    return (
      <p className="rounded-xl bg-stone p-4 text-[0.9375rem] text-ink-soft">
        Comments are open to members at the moment. <a href="/account" className="font-semibold text-navy underline">Sign in</a> to join the conversation.
      </p>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    // Automated sign-ups fill in the hidden field or post instantly.
    if (trap || Date.now() - openedAt.current < 2500) {
      setMsg({ ok: false, text: 'Please take a moment to read before commenting, then try again.' });
      return;
    }
    const problem = validateComment(text, member ? memberName : name, !member);
    if (problem) { setMsg({ ok: false, text: problem }); return; }
    setBusy(true);
    try {
      await postComment(parent, { text, name: member ? memberName : name, replyTo, member });
      if (!member) { try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* ignore */ } }
      setText('');
      setMsg({ ok: true, text: replyTo ? 'Your reply has been posted.' : 'Your comment has been posted.' });
      onDone?.();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Your comment couldn’t be posted.' });
    } finally {
      setBusy(false);
    }
  };

  const id = `c-${parent.id}-${replyTo || 'new'}`;
  return (
    <form onSubmit={submit} className={compact ? 'mt-3' : 'rounded-2xl border border-line bg-surface p-4 sm:p-5'} noValidate>
      {member ? (
        <p className="text-[0.9375rem] text-ink-soft">Commenting as <strong className="text-ink">{memberName}</strong></p>
      ) : (
        <div>
          <label htmlFor={`${id}-name`} className="block text-[0.9375rem] font-semibold">Your name</label>
          <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name"
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 sm:max-w-sm" />
        </div>
      )}
      {/* Hidden from people; automated spam fills it in. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
      </div>
      <label htmlFor={`${id}-text`} className="mt-3 block text-[0.9375rem] font-semibold">{replyTo ? 'Your reply' : 'Your comment'}</label>
      <textarea id={`${id}-text`} dir="auto" value={text} onChange={(e) => setText(e.target.value)} rows={compact ? 3 : 4} maxLength={member ? 2000 : 1000}
        autoFocus={autoFocus} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="cursor-pointer rounded-lg bg-navy px-5 py-2 font-semibold text-white hover:bg-navy-deep disabled:opacity-50">
          {busy ? 'Posting…' : replyTo ? 'Post reply' : 'Post comment'}
        </button>
        {onDone && replyTo && <button type="button" onClick={onDone} className="cursor-pointer font-semibold text-ink-soft underline underline-offset-4">Cancel</button>}
        {!member && <span className="text-[0.8438rem] text-muted">Members can <a href="/account" className="underline">sign in</a> to comment with their profile.</span>}
      </div>
      {msg && <p role="status" className={`mt-3 text-[0.9375rem] ${msg.ok ? 'text-navy' : 'text-crimson'}`}>{msg.text}</p>}
    </form>
  );
};

const CommentItem: React.FC<{
  parent: CommentParent;
  c: ArticleComment;
  replies: ArticleComment[];
  isReply?: boolean;
  orphan?: boolean;
}> = ({ parent, c, replies, isReply, orphan }) => {
  const { hasAnyRole, isAdmin } = useAuth();
  const { publicProfiles } = useData();
  const moderator = isAdmin || hasAnyRole(['content_reviewer', 'publisher']);
  const mine = auth.currentUser?.uid === c.authorUid;
  const profile = c.visitor ? undefined : publicProfiles.find((p) => p.id === c.authorUid);
  const name = profile?.displayName || c.authorName;
  const [mode, setMode] = useState<'none' | 'reply' | 'report' | 'edit'>('none');
  const [reason, setReason] = useState(REASONS[0]);
  const [draft, setDraft] = useState(c.text);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setNote(null);
    try { await fn(); if (ok) setNote({ ok: true, text: ok }); } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : 'That didn’t work. Please try again.' }); }
  };

  return (
    <li className={isReply ? 'mt-4' : 'py-5'}>
      <div className="flex gap-3">
        {profile?.photoUrl ? (
          <MediaImage src={profile.photoUrl} alt="" className={`${isReply ? 'h-8 w-8' : 'h-10 w-10'} shrink-0 rounded-full object-cover`} loading="lazy" />
        ) : (
          <span className="block shrink-0 self-start overflow-hidden rounded-full"><Initials name={name} size={isReply ? 32 : 40} /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {profile ? (
              <a href={`/people/${encodeURIComponent(profile.id)}`} className="font-semibold text-ink hover:underline">{name}</a>
            ) : (
              <span className="font-semibold text-ink">{name}</span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[0.75rem] font-semibold ${c.visitor ? 'bg-stone text-muted' : 'bg-navy-tint text-navy'}`}>{c.visitor ? 'Visitor' : profile ? 'Member' : 'Account'}</span>
            <time dateTime={c.createdAt} className="text-[0.8438rem] text-muted">{when(c.createdAt)}{c.editedAt ? ' · edited' : ''}</time>
          </p>
          {orphan && <p className="text-[0.8125rem] text-muted">Reply to a comment that has been removed</p>}
          {mode === 'edit' ? (
            <div className="mt-2">
              <textarea dir="auto" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={2000} className="w-full rounded-lg border border-line bg-paper px-3 py-2" aria-label="Edit comment" />
              <div className="mt-2 flex gap-3">
                <button type="button" className="cursor-pointer rounded-lg bg-navy px-4 py-1.5 font-semibold text-white" onClick={() => act(async () => { await editComment(parent, c.id, draft); setMode('none'); })}>Save</button>
                <button type="button" className="cursor-pointer font-semibold underline" onClick={() => setMode('none')}>Cancel</button>
              </div>
            </div>
          ) : (
            <p dir="auto" className="mt-1 break-words whitespace-pre-wrap text-ink">{c.text}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.875rem] font-semibold text-ink-soft">
            {!isReply && <button type="button" onClick={() => setMode(mode === 'reply' ? 'none' : 'reply')} className="inline-flex cursor-pointer items-center gap-1 hover:text-ink"><Reply className="h-4 w-4" aria-hidden="true" /> Reply</button>}
            {!mine && <button type="button" onClick={() => setMode(mode === 'report' ? 'none' : 'report')} className="inline-flex cursor-pointer items-center gap-1 hover:text-crimson"><Flag className="h-4 w-4" aria-hidden="true" /> Report</button>}
            {mine && !c.visitor && <button type="button" onClick={() => { setDraft(c.text); setMode('edit'); }} className="inline-flex cursor-pointer items-center gap-1 hover:text-ink"><Pencil className="h-4 w-4" aria-hidden="true" /> Edit</button>}
            {moderator && <button type="button" onClick={() => act(() => setCommentHidden(parent, c.id, true))} className="inline-flex cursor-pointer items-center gap-1 hover:text-crimson"><EyeOff className="h-4 w-4" aria-hidden="true" /> Hide</button>}
            {(mine || moderator) && (
              <button type="button" onClick={() => { if (window.confirm(replies.length && moderator ? 'Delete this comment and its replies?' : 'Delete this comment?')) act(() => deleteComment(parent, c.id, moderator ? replies.map((r) => r.id) : [])); }} className="inline-flex cursor-pointer items-center gap-1 hover:text-crimson">
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
              </button>
            )}
          </div>

          {mode === 'report' && (
            <div className="mt-3 rounded-xl border border-line bg-stone p-3">
              <label className="block text-[0.9375rem] font-semibold" htmlFor={`r-${c.id}`}>What is wrong with this comment?</label>
              <select id={`r-${c.id}`} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 sm:max-w-sm">
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <div className="mt-2 flex gap-3">
                <button type="button" className="cursor-pointer rounded-lg bg-crimson px-4 py-1.5 font-semibold text-white" onClick={() => act(async () => {
                  const r = await reportComment(parent, c, reason);
                  setMode('none');
                  setNote({ ok: true, text: r === 'already' ? 'You have already reported this comment. Our moderators will review it.' : 'Thank you. Our moderators will review this comment.' });
                })}>Send report</button>
                <button type="button" className="cursor-pointer font-semibold underline" onClick={() => setMode('none')}>Cancel</button>
              </div>
            </div>
          )}
          {note && <p role="status" className={`mt-2 text-[0.875rem] ${note.ok ? 'text-navy' : 'text-crimson'}`}>{note.text}</p>}

          {(replies.length > 0 || mode === 'reply') && (
            <ul className="mt-1 border-s-2 border-line ps-4">
              {replies.map((r) => <CommentItem key={r.id} parent={parent} c={r} replies={[]} isReply />)}
              {mode === 'reply' && <li className="mt-2"><CommentForm parent={parent} replyTo={c.id} onDone={() => setMode('none')} autoFocus compact /></li>}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
};

/** The comment section shown beneath articles, videos and activities. */
export const Comments: React.FC<{ parent: CommentParent }> = ({ parent }) => {
  const { siteSettings } = useData();
  const rows = useComments(parent);
  const { top, repliesOf } = useMemo(() => {
    const list = rows || [];
    const ids = new Set(list.map((c) => c.id));
    const repliesOf = new Map<string, ArticleComment[]>();
    const top: { c: ArticleComment; orphan: boolean }[] = [];
    list.forEach((c) => {
      if (c.replyTo && ids.has(c.replyTo)) repliesOf.set(c.replyTo, [...(repliesOf.get(c.replyTo) || []), c]);
      else top.push({ c, orphan: Boolean(c.replyTo) });
    });
    return { top, repliesOf };
  }, [rows]);
  const closed = siteSettings.interactions?.commentsEnabled === false;
  const count = rows?.length || 0;

  return (
    <section aria-labelledby={`comments-${parent.id}`} className="mt-12">
      <h2 id={`comments-${parent.id}`} className="flex items-center gap-2 text-[1.5rem] font-semibold">
        <MessageSquare className="h-6 w-6 text-navy" aria-hidden="true" /> Comments{rows ? ` (${count})` : ''}
      </h2>
      <p className="mt-1 text-[0.9375rem] text-muted">
        Be respectful. Comments that are abusive, hateful, spam or share someone’s personal information are removed, whoever posts them.
      </p>

      {rows === null ? (
        <p className="mt-6 text-muted">Loading comments…</p>
      ) : count === 0 ? (
        <p className="mt-6 text-ink-soft">No comments yet.{closed ? '' : ' Be the first to comment.'}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {top.map(({ c, orphan }) => <CommentItem key={c.id} parent={parent} c={c} replies={repliesOf.get(c.id) || []} orphan={orphan} />)}
        </ul>
      )}

      <div className="mt-6">
        {closed ? <p className="rounded-xl bg-stone p-4 text-ink-soft">Comments are closed.</p> : <CommentForm parent={parent} />}
      </div>
    </section>
  );
};
