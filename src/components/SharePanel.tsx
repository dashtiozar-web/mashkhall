import React, { useEffect, useState } from 'react';
import { Check, Link2, Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getMyClaim, PLATFORMS, SHARE_STATUS_LABEL, ShareClaim, SharePlatform, shareLinks, submitShareClaim } from '../lib/shares';
import { POINT_VALUES } from '../lib/ledger';

/**
 * Share buttons, and for members a way to claim points for a share: they
 * send the link to their post and an administrator checks it.
 */
export const SharePanel: React.FC<{ targetType: 'article' | 'activity'; targetId: string; title: string; url?: string; onShared?: () => void }> = ({ targetType, targetId, title, url, onShared }) => {
  const { currentUser, isMember, userProfile } = useAuth();
  const pageUrl = url || window.location.origin + window.location.pathname;
  const [copied, setCopied] = useState(false);
  const [claim, setClaim] = useState<ShareClaim | null | undefined>(undefined);
  const [platform, setPlatform] = useState<SharePlatform>('facebook');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!currentUser || !isMember) { setClaim(null); return; }
    getMyClaim(targetType, targetId).then(setClaim);
  }, [currentUser?.uid, isMember, targetType, targetId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      onShared?.();
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard unavailable */ }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const host = (() => { try { return new URL(link.trim()).hostname; } catch { return ''; } })();
    if (!host) { setMsg({ ok: false, text: 'Paste the full link to your post, starting with https://' }); return; }
    const p = PLATFORMS.find((x) => x.id === platform)!;
    if (platform !== 'other' && !p.host.test(host)) { setMsg({ ok: false, text: `That link isn’t a ${p.label} link. Choose the right platform or check the link.` }); return; }
    setBusy(true);
    try {
      await submitShareClaim({ targetType, targetId, targetTitle: title, platform, url: link, userName: userProfile?.displayName });
      setClaim(await getMyClaim(targetType, targetId));
      setLink('');
      setMsg({ ok: true, text: 'Thank you! We’ll check your post and add the points.' });
    } catch (err) {
      const text = err instanceof Error ? err.message : '';
      setMsg({ ok: false, text: /permission/i.test(text) ? 'Your link could not be sent. You may already have sent one for this.' : text || 'Your link could not be sent.' });
    } finally {
      setBusy(false);
    }
  };

  const canClaim = currentUser && isMember && claim !== undefined && (!claim || claim.status === 'rejected');

  return (
    <section aria-labelledby={`share-${targetId}`} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 id={`share-${targetId}`} className="flex items-center gap-2 font-sans text-[1.125rem] font-semibold"><Share2 className="h-5 w-5 text-navy" aria-hidden="true" /> Share this {targetType === 'article' ? 'article' : 'activity'}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {shareLinks(pageUrl, title).map((s) => (
          <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" onClick={() => onShared?.()} className="rounded-full border border-line px-3.5 py-1.5 text-[0.9375rem] font-semibold text-ink no-underline hover:border-ink/40">{s.label}</a>
        ))}
        <button type="button" onClick={copy} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3.5 py-1.5 text-[0.9375rem] font-semibold hover:border-ink/40">
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}{copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>

      {currentUser && isMember && claim && claim.status !== 'rejected' && (
        <p className="mt-4 rounded-lg bg-stone px-4 py-3 text-[0.9375rem]">You sent the link to your post: <strong>{SHARE_STATUS_LABEL[claim.status]}</strong>.</p>
      )}
      {canClaim && (
        <form onSubmit={send} className="mt-4 border-t border-line pt-4">
          <p className="text-[0.9375rem] text-ink-soft">
            <strong className="text-ink">Members: earn {POINT_VALUES.share_verified} points.</strong> After sharing, paste the link to your public post. We check it before adding the points (once per {targetType}).
            {claim?.status === 'rejected' && <span className="block text-crimson">Your previous link couldn’t be verified{claim.reviewNote ? `: ${claim.reviewNote}` : ''}. You can send a new one.</span>}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor={`plat-${targetId}`}>Where you shared it</label>
            <select id={`plat-${targetId}`} value={platform} onChange={(e) => setPlatform(e.target.value as SharePlatform)} className="rounded-lg border border-line bg-paper px-3 py-2">
              {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <label className="sr-only" htmlFor={`link-${targetId}`}>Link to your post</label>
            <input id={`link-${targetId}`} value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" placeholder="https://www.facebook.com/…/posts/…" className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 focus:border-navy focus:outline-none" />
            <button type="submit" disabled={busy || !link.trim()} className="cursor-pointer rounded-lg bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send link'}</button>
          </div>
        </form>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 rounded-lg px-4 py-2.5 text-[0.9375rem] ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}
    </section>
  );
};
