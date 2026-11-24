import React, { useEffect, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { Button } from '../components/ui';
import { meetingApi } from '../lib/meetings';
import { resolveImage, uploadImage } from '../lib/media';
import { useAuth } from '../context/AuthContext';

/**
 * After a leader confirms a meeting's attendance, a public activity post
 * waits here. The administrator checks it and publishes it to "Our
 * activities". Only the title, purpose, date, group and a collage of the
 * confirmed attendees' public profile photos are ever published: never
 * recordings, chat, shared files, absentees or attendance details.
 */

export interface MeetingPost {
  id: string; meetingId: string; roomId: string; roomName: string; title: string; purpose: string; date: string; attendees: string[]; status: string;
}

const loadImg = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

/** A collage of public profile photos (members without one are left out). */
const makeCollage = async (uids: string[]): Promise<{ blob: Blob | null; used: number; skipped: number }> => {
  const photos: HTMLImageElement[] = [];
  let skipped = 0;
  for (const uid of uids.slice(0, 60)) {
    const p = await getDoc(doc(db, 'public_profiles', uid)).catch(() => null);
    const data = p?.exists() ? p.data() : null;
    // Only members who are listed publicly with a profile photo appear.
    if (!data?.photoUrl || data.membershipStatus === 'suspended') { skipped += 1; continue; }
    const url = await resolveImage(data.photoUrl);
    const img = url ? await loadImg(url) : null;
    if (img) photos.push(img); else skipped += 1;
  }
  if (!photos.length) return { blob: null, used: 0, skipped };
  const cols = Math.min(8, Math.ceil(Math.sqrt(photos.length * 1.6)));
  const rows = Math.ceil(photos.length / cols);
  const cell = 180;
  const gap = 8;
  const pad = 24;
  const canvas = document.createElement('canvas');
  canvas.width = pad * 2 + cols * cell + (cols - 1) * gap;
  canvas.height = pad * 2 + rows * cell + (rows - 1) * gap;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blob: null, used: 0, skipped };
  ctx.fillStyle = '#0C1B36';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  photos.forEach((img, i) => {
    const x = pad + (i % cols) * (cell + gap);
    const y = pad + Math.floor(i / cols) * (cell + gap);
    // Cover-crop each photo into a square, keeping the top (faces).
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - s) / 2;
    const sy = img.naturalHeight > img.naturalWidth ? 0 : (img.naturalHeight - s) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, cell, cell, 14);
    ctx.clip();
    ctx.drawImage(img, sx, sy, s, s, x, y, cell, cell);
    ctx.restore();
  });
  try {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
    return { blob, used: photos.length, skipped };
  } catch {
    return { blob: null, used: 0, skipped };
  }
};

const PostEditor: React.FC<{ post: MeetingPost; onChanged: () => void }> = ({ post, onChanged }) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState(post.title);
  const [purpose, setPurpose] = useState(post.purpose);
  const [showGroup, setShowGroup] = useState(true);
  const [state, setState] = useState<'making' | 'ready' | 'failed'>('making');
  const [preview, setPreview] = useState('');
  const [counts, setCounts] = useState({ used: 0, skipped: 0 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    let alive = true;
    makeCollage(post.attendees).then((r) => {
      if (!alive) return;
      blobRef.current = r.blob;
      setCounts({ used: r.used, skipped: r.skipped });
      if (r.blob) { setPreview(URL.createObjectURL(r.blob)); setState('ready'); } else setState('failed');
    });
    return () => { alive = false; };
  }, [post.attendees]);

  const publish = async () => {
    if (!blobRef.current || !currentUser) return;
    setBusy(true);
    setMessage('');
    try {
      const file = new File([blobRef.current], `${post.meetingId}.jpg`, { type: 'image/jpeg' });
      const { ref } = await uploadImage(file, { uid: currentUser.uid, name: currentUser.displayName || '' }, `Members who took part in ${title}`, 1600);
      await meetingApi('publish-post', { meetingId: post.meetingId, title, purpose, showGroup, imageRef: ref });
      onChanged();
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };

  const dismiss = async () => {
    if (!window.confirm('Do not publish a post for this meeting?')) return;
    setBusy(true);
    try { await meetingApi('dismiss-post', { meetingId: post.meetingId }); onChanged(); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-5 rounded-xl border border-line bg-paper p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <label className="block font-semibold">Title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2" dir="auto" /></label>
        <label className="block font-semibold">Short description of the purpose<textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={400} rows={3} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2" dir="auto" /></label>
        <p className="text-[0.9375rem] text-ink-soft">Date: {new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' })}</p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={showGroup} onChange={(e) => setShowGroup(e.target.checked)} /> Show the group: {post.roomName}</label>
        {message && <p className="text-crimson" role="alert">{message}</p>}
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy || state !== 'ready' || title.trim().length < 3} onClick={publish}>{busy ? 'Publishing…' : 'Publish to Our activities'}</Button>
          <Button variant="secondary" disabled={busy} onClick={dismiss}>Do not publish</Button>
        </div>
      </div>
      <div>
        {state === 'making' && <p className="flex items-center gap-2 text-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Making the photo collage…</p>}
        {state === 'ready' && <img src={preview} alt="Collage of the members who attended" className="w-full rounded-lg" />}
        {state === 'failed' && <p className="rounded-lg bg-amber-tint p-3">No collage could be made: none of the {post.attendees.length} confirmed attendees has a public profile photo. This post stays pending until members add photos, or you can choose not to publish it.</p>}
        {state === 'ready' && <p className="mt-2 text-[0.875rem] text-muted">{counts.used} confirmed attendees with public profile photos{counts.skipped ? `; ${counts.skipped} without a public photo are not shown` : ''}.</p>}
      </div>
    </div>
  );
};

export const MeetingPostsAdmin: React.FC<{ posts: MeetingPost[]; onChanged: () => void }> = ({ posts, onChanged }) => {
  if (!posts.length) return null;
  return (
    <section className="rounded-2xl border border-amber/60 bg-surface p-5 sm:p-6">
      <h2 className="text-[1.375rem] font-semibold">Activity posts waiting for review ({posts.length})</h2>
      <p className="mt-1 text-ink-soft">Created when a meeting’s attendance is confirmed. Only the title, purpose, date, group and a collage of confirmed attendees’ public photos are published.</p>
      <div className="mt-4 space-y-4">{posts.map((p) => <PostEditor key={p.id} post={p} onChanged={onChanged} />)}</div>
    </section>
  );
};
