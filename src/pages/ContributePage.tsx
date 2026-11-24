import React, { useEffect, useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, Copy, FileText, ImagePlus, Megaphone, Newspaper, ScrollText, ShieldAlert, Video, X } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Button, Container, PageHeader } from '../components/ui';
import { BankTransferDetails, VoluntaryContribution } from '../components/BankTransferDetails';
import { TOPICS } from '../data/initialData';
import { uploadImage } from '../lib/media';
import { videoEmbed, videoTags, VIDEO_HELP, SUBTITLE_LANGUAGES } from '../lib/video';
import {
  categoryOf, claimPayment, DISCOUNT_AFTER, DISCOUNT_PERCENT, FEES, feeFor, FREE_AFTER,
  PAYMENT_STATUS_LABEL, pounds, SUBMISSION_STATUS_LABEL, SubmissionPayment, useMySubmissions,
} from '../lib/contributions';
import {
  feeCategoryOf, GUEST_KINDS, guestFeeFor, GuestKind, GuestSubmission, rememberedSubmissions, statusPath, submitGuestWork, SubmissionRefused, uploadGuestImage,
} from '../lib/guestSubmissions';
import { Article } from '../types';
import { reportSecurityEvent } from '../lib/visits';
import { ContributeStatus, MySubmissionsInThisBrowser } from './ContributeStatus';

const field = 'mt-1 block w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[1rem] font-normal text-ink focus:border-navy focus:outline-none';
const label = 'block text-[0.9375rem] font-semibold text-ink';

const KIND_ICON: Record<GuestKind, React.FC<{ className?: string }>> = {
  article: FileText, report: ScrollText, video: Video, news: Newspaper, statement: Megaphone, other: FileText,
};

const LANGUAGES: { id: string; label: string; dir: 'ltr' | 'rtl' }[] = [
  { id: 'en', label: 'English', dir: 'ltr' },
  { id: 'ckb', label: 'Kurdish (Sorani)', dir: 'rtl' },
  { id: 'ar', label: 'Arabic', dir: 'rtl' },
  { id: 'kmr', label: 'Kurdish (Kurmanji)', dir: 'ltr' },
  { id: 'fa', label: 'Persian', dir: 'rtl' },
  { id: 'other', label: 'Another language', dir: 'ltr' },
];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The publication fee table, from the one central pricing configuration. */
export const FeeTable: React.FC = () => (
  <section className="rounded-xl border border-line bg-surface p-5">
    <h2 className="font-sans text-[1.0625rem] font-semibold">Fees for visitors</h2>
    <table className="mt-3 w-full text-[0.9375rem]">
      <thead className="text-start text-[0.8125rem] text-muted"><tr><th className="py-1 text-start font-semibold"><span className="sr-only">Level</span></th><th className="py-1 text-start font-semibold">Article</th><th className="py-1 text-start font-semibold">Video</th></tr></thead>
      <tbody className="divide-y divide-line tabular-nums">
        <tr><td className="py-1.5">Standard</td><td>{pounds(FEES.article.standard)}</td><td>{pounds(FEES.video.standard)}</td></tr>
        <tr><td className="py-1.5"><span>After</span> <span>{DISCOUNT_AFTER}</span> <span>published</span></td><td>{pounds(FEES.article.discounted)}</td><td>{pounds(FEES.video.discounted)}</td></tr>
        <tr><td className="py-1.5"><span>After</span> <span>{FREE_AFTER}</span> <span>published</span></td><td>Free</td><td>Free</td></tr>
      </tbody>
    </table>
    <p className="mt-3 text-[0.8125rem] text-muted">Articles and videos are counted separately, and only published work counts. Discounts apply automatically. News, statements and other publications are charged as articles.</p>
  </section>
);

const Steps: React.FC = () => (
  <section className="rounded-xl border border-line bg-surface p-5">
    <h2 className="font-sans text-[1.0625rem] font-semibold">How it works</h2>
    <ol className="mt-3 space-y-3 text-[0.9375rem]">
      {[
        ['Send your work', 'No account or membership needed. You get a private link to follow it.'],
        ['Pay the fee', 'You see the fee before you send. Pay by bank transfer with your reference; no fee after 20 published items.'],
        ['Editorial review', 'Once the payment is confirmed, our editors read your work and may ask for changes. If it is not accepted, we refund the fee.'],
        ['Publication', 'Approved work is published under your name.'],
      ].map(([t, d], i) => (
        <li key={t} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[0.875rem] font-bold text-white tabular-nums">{i + 1}</span>
          <span><span className="block font-semibold">{t}</span><span className="block text-ink-soft">{d}</span></span>
        </li>
      ))}
    </ol>
  </section>
);

export const ContributePage: React.FC<{ onNavigate: (tab: string, param?: string) => void; onOpenAuth: (mode?: 'signin' | 'signup') => void; param?: string }> = ({ onNavigate, onOpenAuth, param }) => {
  const statusId = param?.startsWith('status/') ? param.slice('status/'.length).split('?')[0] : '';
  if (statusId) return <ContributeStatus id={statusId} onNavigate={onNavigate} onOpenAuth={onOpenAuth} />;
  return <ContributeForm onNavigate={onNavigate} onOpenAuth={onOpenAuth} />;
};

const ContributeForm: React.FC<{ onNavigate: (tab: string, param?: string) => void; onOpenAuth: (mode?: 'signin' | 'signup') => void }> = ({ onNavigate, onOpenAuth }) => {
  const { currentUser, isMember, userProfile } = useAuth();
  const { createArticleSubmission } = useData();
  const legacy = useMySubmissions(currentUser && !currentUser.isAnonymous ? currentUser.uid : undefined);
  const member = Boolean(currentUser) && isMember;

  const [kind, setKind] = useState<GuestKind>(() => {
    try { return new URLSearchParams(window.location.search).get('kind') === 'video' ? 'video' : 'article'; } catch { return 'article'; }
  });
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [topic, setTopic] = useState('legal');
  const [language, setLanguage] = useState('en');
  const [sources, setSources] = useState('');
  const [topics, setTopics] = useState('');
  const [subtitles, setSubtitles] = useState<string[]>([]);
  const [videosOnly, setVideosOnly] = useState(false);
  const [images, setImages] = useState<{ id: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [safetyOk, setSafetyOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const [voluntary, setVoluntary] = useState<'yes' | 'no' | ''>('');
  const [website, setWebsite] = useState(''); // left empty by people; filled by spam programs
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sent, setSent] = useState<GuestSubmission | null>(null);
  const [copied, setCopied] = useState(false);
  const mine = useMemo(() => rememberedSubmissions(), [sent]);
  // The fee for this submission, shown before sending (from the central
  // pricing and the number of items already published under this email).
  const [fee, setFee] = useState<{ amountPence: number; standardPence: number; tier: string; count: number } | null>(null);

  // Signed-in people (not members) do not have to type their details again.
  useEffect(() => {
    if (currentUser && !currentUser.isAnonymous) {
      setEmail((e) => e || currentUser.email || '');
      setName((n) => n || userProfile?.displayName || currentUser.displayName || '');
    }
  }, [currentUser, userProfile?.displayName]);

  const dirOfWork = LANGUAGES.find((l) => l.id === language)?.dir || 'ltr';
  const isVideo = kind === 'video';

  const addPhoto = async (file?: File) => {
    if (!file) return;
    if (images.length >= 4) { setMsg({ ok: false, text: 'You can add up to 4 photos.' }); return; }
    setUploading(true);
    setMsg(null);
    try {
      if (member && currentUser) {
        const { ref, image } = await uploadImage(file, { uid: currentUser.uid, name: userProfile?.displayName }, title);
        setImages((xs) => [...xs, { id: ref, preview: image.dataUrl }]);
      } else {
        const img = await uploadGuestImage(file);
        setImages((xs) => [...xs, img]);
      }
    } catch (e) {
      reportSecurityEvent('upload_rejected');
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'The photo could not be uploaded.' });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (member) { setFee(null); return; }
    const category = feeCategoryOf(kind);
    if (!EMAIL.test(email.trim())) {
      setFee({ ...feeFor(category, 0), count: 0 });
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      guestFeeFor(email, category).then((f) => { if (live) setFee(f); }).catch(() => undefined);
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [email, kind, member]);

  const validate = () => {
    if (title.trim().length < 5) return 'Please give your work a title (at least 5 characters).';
    if (isVideo && !videoEmbed(videoUrl)) return 'Please add the link to your video on YouTube, Vimeo or Facebook.';
    if (isVideo && content.trim().length < 20) return 'Please describe the video in a few sentences: what it shows, where and when.';
    if (!isVideo && content.trim().length < 200) return 'Please write at least a few paragraphs (200 characters or more).';
    if (videoUrl.trim() && !videoEmbed(videoUrl)) return VIDEO_HELP;
    if (!member) {
      if (name.trim().length < 2) return 'Please enter your name as it should appear with your work.';
      if (!EMAIL.test(email.trim())) return 'Please enter a valid email address, so the editors can contact you.';
    }
    if (!safetyOk || !termsOk) return 'Please confirm both statements at the end of the form.';
    if (member && !voluntary) return 'Please answer the question about a voluntary contribution.';
    if (uploading) return 'Please wait for the photo to finish uploading.';
    return '';
  };

  const reset = () => {
    setTitle(''); setExcerpt(''); setContent(''); setVideoUrl(''); setSources(''); setImages([]); setTopics(''); setSubtitles([]); setVideosOnly(false);
    setSafetyOk(false); setTermsOk(false); setVoluntary('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (website) return; // a spam program filled the hidden field
    const problem = validate();
    if (problem) { setMsg({ ok: false, text: problem }); return; }
    setBusy(true);
    try {
      if (member) {
        const body = content.trim() || excerpt.trim();
        const base: Partial<Article> = {
          title: title.trim(),
          excerpt: (excerpt.trim() || body.slice(0, 180)).slice(0, 2000),
          content: body,
          category: kind === 'news' || kind === 'statement' ? 'political' : topic,
          tags: isVideo ? videoTags(topics, subtitles, videosOnly) : kind === 'statement' ? ['statement'] : kind === 'news' ? ['news'] : [],
          contentType: isVideo ? 'video_speech' : kind === 'report' ? 'monitoring_report' : 'article',
          videoUrl: videoUrl.trim() || undefined,
          coverImageUrl: images[0]?.id,
          coverImageAlt: images[0] ? title.trim() : undefined,
          sourceLinks: sources.trim() || undefined,
          direction: dirOfWork,
          language,
        };
        await createArticleSubmission({ ...base, status: 'submitted', contributorType: 'member' });
        setMsg({ ok: true, text: 'Thank you. Your work has been sent to the editorial team for review. You can follow it from your account.' });
      } else {
        const s = await submitGuestWork({
          kind, title, excerpt, content, topic, videoUrl, sourceLinks: sources,
          tags: isVideo ? videoTags(topics, subtitles, videosOnly) : undefined,
          direction: dirOfWork, language, images: images.map((i) => i.id),
          contact: { name, email, phone, country },
        });
        try { sessionStorage.setItem(`17shubat_new_${s.id}`, '1'); } catch { /* storage blocked */ }
        setSent(s);
        onNavigate('contribute', `status/${s.id}`);
        return;
      }
      reset();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      const text = err instanceof Error ? err.message : '';
      if (err instanceof SubmissionRefused) reportSecurityEvent(err.reason === 'rules_outdated' ? 'rules_outdated' : 'submission_refused');
      else if (/permission|insufficient|refused/i.test(text)) reportSecurityEvent('submission_refused');
      setMsg({ ok: false, text: text || 'Your submission could not be sent. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const link = sent ? `${window.location.origin}${statusPath(sent.id)}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* not allowed */ }
  };

  return (
    <>
      <PageHeader title="Publish with 17 Shubat" intro="Send us articles, reports, videos, news and statements on human rights, democracy, freedom of expression and Kurdish affairs. You do not need an account or a membership. Everything is reviewed by our editorial team before it is published." />
      <Container className="grid gap-8 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
        <div className="min-w-0 space-y-6">
          {msg && (
            <p role={msg.ok ? 'status' : 'alert'} className={`flex items-start gap-2 rounded-lg px-4 py-3 ${msg.ok ? 'border border-navy/20 bg-navy-tint text-ink' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>
              {msg.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-navy" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}<span>{msg.text}</span>
            </p>
          )}

          {sent && (
            <section role="status" className="rounded-xl border border-line border-t-4 border-t-navy bg-surface p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-[1.375rem] font-semibold"><CheckCircle2 className="h-6 w-6 text-navy" aria-hidden="true" /> Thank you. Your work has been received.</h2>
              <p className="mt-2 text-ink-soft">It is now waiting for editorial review. It will not be published until the editors approve it. If a fee applies, we will show it on your tracking page with our bank details.</p>
              <p className="mt-4 text-[0.9375rem] font-semibold">Your private tracking link</p>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <code className="ltr-value min-w-0 flex-1 truncate rounded-lg border border-line bg-paper px-3 py-2 text-[0.875rem]" dir="ltr" translate="no">{link}</code>
                <Button variant="secondary" onClick={copy}><Copy className="h-4 w-4" aria-hidden="true" /> {copied ? 'Copied' : 'Copy link'}</Button>
              </div>
              <p className="mt-2 text-[0.8125rem] text-muted">Keep this link private: anyone who has it can see the status of your submission. It is also remembered in this browser. If you lose it, contact us with your name and the title of your work.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href={statusPath(sent.id)} className="inline-flex items-center rounded-lg bg-navy px-5 py-2.5 font-semibold text-white no-underline hover:bg-navy-deep">Follow my submission</a>
                <Button variant="secondary" onClick={() => setSent(null)}>Send another</Button>
              </div>
            </section>
          )}

          {!sent && (
            <form onSubmit={submit} className="space-y-7 rounded-xl border border-line bg-surface p-5 sm:p-7" noValidate>
              {member ? (
                <p className="rounded-lg border border-navy/20 bg-navy-tint px-4 py-3 text-[0.9375rem]">You are signed in as a member, so there is no publication fee. Your work goes to the editors and you can follow it from your account.</p>
              ) : (
                <>
                  <div className="flex flex-col gap-3 rounded-lg border border-navy/25 bg-navy-tint px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    {currentUser && !currentUser.isAnonymous ? (
                      <p className="text-[0.9375rem]"><strong>Are you a member of 17 Shubat?</strong> This account is not linked to a membership. Sign in with the account your membership was approved on, or contact us. Members publish without a fee.</p>
                    ) : (
                      <>
                        <p className="text-[0.9375rem]"><strong>Are you a member of 17 Shubat?</strong> Sign in with your member account first. Members publish without a fee, and their work goes straight to editorial review.</p>
                        <Button className="shrink-0" onClick={() => onOpenAuth('signin')}>Sign in as a member</Button>
                      </>
                    )}
                  </div>
                  <p className="rounded-lg border border-line bg-paper px-4 py-3 text-[0.9375rem] text-ink-soft">Not a member? Contributors are independent authors, not members of the organisation. Sending or publishing work does not make you a member and does not give you any position, membership number or card.</p>
                </>
              )}

              <fieldset>
                <legend className="text-[1.25rem] font-semibold"><span className="text-crimson tabular-nums">1.</span> What are you sending?</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {GUEST_KINDS.map((k) => {
                    const Icon = KIND_ICON[k.id];
                    return (
                      <label key={k.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${kind === k.id ? 'border-navy bg-navy-tint' : 'border-line hover:border-ink/40'}`}>
                        <input type="radio" name="kind" checked={kind === k.id} onChange={() => setKind(k.id)} className="mt-1 h-4 w-4 accent-[var(--c-navy)]" />
                        <span><span className="flex items-center gap-1.5 font-semibold"><Icon className="h-4 w-4" aria-hidden="true" />{k.label}</span><span className="block text-[0.8438rem] text-muted">{k.help}</span></span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-[0.8125rem] text-muted">{kind === 'video' ? <><span>Fee category: video</span> (<span>{pounds(FEES.video.standard)}</span> <span>standard</span>)</> : <><span>Fee category: article</span> (<span>{pounds(FEES.article.standard)}</span> <span>standard</span>)</>}. <span>Members publish without a fee.</span></p>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-[1.25rem] font-semibold"><span className="text-crimson tabular-nums">2.</span> Your work</legend>
                <label className={label}>Title<input dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} className={field} required /></label>
                <div className="grid gap-4 sm:grid-cols-2">
                  {kind !== 'news' && kind !== 'statement' && (
                    <label className={label}>Category
                      <select value={topic} onChange={(e) => setTopic(e.target.value)} className={field}>
                        {TOPICS.filter((t) => t.id !== 'all').map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </label>
                  )}
                  <label className={label}>Language of your work
                    <select value={language} onChange={(e) => setLanguage(e.target.value)} className={field}>
                      {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                    <span className="mt-1 block text-[0.8125rem] font-normal text-muted">Your work is published in the language you write it in. It is never translated automatically.</span>
                  </label>
                </div>
                {isVideo && (
                  <label className={label}>Video link<input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className={field} /><span className="mt-1 block text-[0.8125rem] font-normal text-muted">{VIDEO_HELP}</span></label>
                )}
                <label className={label}>Short summary <span className="font-normal text-muted">(optional)</span><textarea dir={dirOfWork} rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={500} className={field} /></label>
                <label className={label}>{isVideo ? 'Description' : 'Text'}<textarea dir={dirOfWork} rows={isVideo ? 5 : 14} value={content} onChange={(e) => setContent(e.target.value)} className={field} />
                  <span className="mt-1 block text-[0.8125rem] font-normal text-muted">Start a line with “## ” for a heading and “- ” for a list item. Leave an empty line between paragraphs.</span>
                </label>
                {isVideo && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={label}>Tags <span className="font-normal text-muted">(optional, separated by commas)</span>
                      <input dir="auto" value={topics} onChange={(e) => setTopics(e.target.value)} maxLength={300} placeholder="e.g. protest, Sulaimani, press freedom" className={field} />
                    </label>
                    <label className={label}>Where it appears
                      <select value={videosOnly ? 'videos' : 'both'} onChange={(e) => setVideosOnly(e.target.value === 'videos')} className={field}>
                        <option value="both">Public: Videos and News</option>
                        <option value="videos">Public: Videos section only</option>
                      </select>
                    </label>
                    <fieldset className="sm:col-span-2">
                      <legend className={label}>Subtitles in the video <span className="font-normal text-muted">(optional)</span></legend>
                      <div className="mt-1 flex flex-wrap gap-4">
                        {SUBTITLE_LANGUAGES.map((l) => (
                          <label key={l.id} className="flex items-center gap-2 text-[0.9375rem]">
                            <input type="checkbox" checked={subtitles.includes(l.id)} onChange={(e) => setSubtitles((xs) => (e.target.checked ? [...xs, l.id] : xs.filter((x) => x !== l.id)))} /> {l.label}
                          </label>
                        ))}
                      </div>
                      <span className="mt-1 block text-[0.8125rem] font-normal text-muted">Add subtitles on YouTube or Vimeo before sending; they play on our website too.</span>
                    </fieldset>
                  </div>
                )}
                {!isVideo && (
                  <label className={label}>Video link <span className="font-normal text-muted">(optional)</span><input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className={field} /></label>
                )}
                <label className={label}>Sources <span className="font-normal text-muted">(optional: links or references, one per line)</span><textarea dir="ltr" rows={3} value={sources} onChange={(e) => setSources(e.target.value)} className={field} /></label>
                <div>
                  <p className={label}>{isVideo ? <>Thumbnail image <span className="font-normal text-muted">(optional; YouTube’s own image is used if you add none)</span></> : <>Photos <span className="font-normal text-muted">(optional, up to 4; the first is the cover)</span></>}</p>
                  {images.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {images.map((img, i) => (
                        <li key={img.id} className="relative">
                          <img src={img.preview} alt="" className="h-20 w-28 rounded-md border border-line object-cover" />
                          <button type="button" onClick={() => setImages((xs) => xs.filter((x) => x.id !== img.id))} aria-label={`Remove photo ${i + 1}`}
                            className="absolute -top-2 -end-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-ink text-white"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {images.length < (isVideo ? 1 : 4) && (
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-4 py-2 font-semibold hover:border-navy">
                      <ImagePlus className="h-4 w-4" aria-hidden="true" /> {uploading ? 'Uploading…' : isVideo ? 'Add a thumbnail' : 'Add a photo'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { addPhoto(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                  )}
                  <p className="mt-1 text-[0.8125rem] text-muted">Hidden details in photos, such as GPS location and camera information, are removed when they are uploaded. Videos are shared as links to YouTube, Vimeo or Facebook.</p>
                </div>
              </fieldset>

              {!member && (
                <fieldset className="space-y-4">
                  <legend className="text-[1.25rem] font-semibold"><span className="text-crimson tabular-nums">3.</span> Your contact details</legend>
                  <p className="text-[0.9375rem] text-ink-soft">The editors use these to contact you about your submission. Your name is published with your work; your email and phone number are never published.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={label}>Name to publish with your work<input dir="auto" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" className={field} required /></label>
                    <label className={label}>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" className={field} required /></label>
                    <label className={label}>Phone <span className="font-normal text-muted">(optional)</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} autoComplete="tel" className={field} /></label>
                    <label className={label}>Country you live in <span className="font-normal text-muted">(optional)</span><input dir="auto" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={80} autoComplete="country-name" className={field} /></label>
                  </div>
                  <p className="text-[0.8125rem] text-muted">Discounts are counted by email address: use the same email each time you send work.</p>
                  {/* Hidden from people; spam programs fill it in. */}
                  <label className="absolute -start-[10000px] h-px w-px overflow-hidden" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
                </fieldset>
              )}

              <fieldset className="space-y-4">
                <legend className="text-[1.25rem] font-semibold"><span className="text-crimson tabular-nums">{member ? '3.' : '4.'}</span> Check and send</legend>
                <div className="rounded-lg border-2 border-amber/60 bg-amber-tint p-4">
                  <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-5 w-5 text-ember" aria-hidden="true" /> Before you send: your safety</p>
                  <ul className="mt-2 list-disc space-y-1 ps-5 text-[0.9375rem]">
                    <li>Faces, voices, names, usernames, uniforms, number plates, buildings and backgrounds in photos and videos can reveal who and where you are, or who the people around you are.</li>
                    <li>Videos on YouTube or Facebook keep their own details; check them before sharing the link.</li>
                    <li>We cannot promise anonymity, and we cannot tell whether your connection is being watched. If you are in Iran, Iraq or anywhere you may be at risk, read our <a href="/legal#safety" className="font-semibold underline">safety advice</a> first.</li>
                  </ul>
                  <label className="mt-3 flex items-start gap-3 text-[0.9375rem] font-semibold"><input type="checkbox" checked={safetyOk} onChange={(e) => setSafetyOk(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" /> I have read this and checked my work for details that could put me or others at risk.</label>
                </div>
                <label className="flex items-start gap-3 text-[0.9375rem] font-semibold">
                  <input type="checkbox" checked={termsOk} onChange={(e) => setTermsOk(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
                  <span>{member
                    ? 'This is my own work or I have permission to share it. I understand it is published only if the editorial team approves it.'
                    : <>I accept the <a href="/legal#terms" className="underline">publication terms</a> and the <a href="/legal#privacy" className="underline">privacy notice</a>. This is my own work or I have permission to share it. I understand that any fee is paid before editorial review and refunded if my work is not accepted, that paying does not guarantee publication or mean 17 Shubat endorses my views, and that sending work does not make me a member.</>}</span>
                </label>

                {member ? <VoluntaryContribution value={voluntary} onChange={setVoluntary} /> : (
                  <div className="rounded-lg border-2 border-navy/25 bg-navy-tint/50 p-4 text-[0.9375rem]">
                    <p className="flex flex-wrap items-baseline gap-x-2 font-semibold">
                      <span>Publication fee:</span>
                      <strong className="text-[1.25rem] text-navy tabular-nums">{fee ? (fee.amountPence ? pounds(fee.amountPence) : 'Free') : '…'}</strong>
                      {fee?.tier === 'discount' && <span className="text-[0.875rem] font-normal text-ink-soft"><span>({DISCOUNT_PERCENT}% off</span> <span className="tabular-nums">{pounds(fee.standardPence)}</span><span>, for your earlier published work)</span></span>}
                    </p>
                    {fee && fee.amountPence > 0 ? (
                      <p className="mt-1 text-ink-soft">After you send your work, the next page shows our bank details and your payment reference. Editorial review starts once we have confirmed the payment. If the editors do not accept your work, we refund the fee.</p>
                    ) : fee ? (
                      <p className="mt-1 text-ink-soft">No fee is due, thanks to your earlier published work. Your work goes straight to editorial review.</p>
                    ) : null}
                  </div>
                )}
              </fieldset>

              <Button type="submit" size="lg" disabled={busy || uploading}>{busy ? 'Sending…' : !member && fee && fee.amountPence > 0 ? 'Send and go to payment' : 'Send for editorial review'}</Button>
            </form>
          )}

          {mine.length > 0 && <MySubmissionsInThisBrowser ids={mine} />}

          {legacy && legacy.articles.length > 0 && (
            <LegacySubmissions rows={legacy.articles} payments={legacy.payments} />
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <FeeTable />
          <Steps />
          <section className="band-texture rounded-xl p-5">
            <h2 className="font-sans text-[1.0625rem] font-semibold">{member ? 'You publish as a member' : 'Members publish without fees'}</h2>
            <p className="mt-1 text-[0.9375rem] text-white/80">{member ? 'There is no fee for members. You can choose to make a voluntary contribution.' : 'Membership is separate from publishing. It needs its own application and approval by the committee; it is never given because work is published.'}</p>
            {!member && <button type="button" onClick={() => onNavigate('apply')} className="mt-3 cursor-pointer rounded-lg bg-white px-4 py-2 font-semibold text-[#0C1B36]">About membership</button>}
          </section>
        </aside>
      </Container>
    </>
  );
};

/** Work sent from a contributor account before Publish with Us stopped needing one. */
const LegacySubmissions: React.FC<{ rows: Article[]; payments: Record<string, SubmissionPayment> }> = ({ rows, payments }) => {
  const visible = useMemo(() => rows.filter((a) => a.contributorType === 'visitor' || a.status !== 'draft'), [rows]);
  if (!visible.length) return null;
  return (
    <section aria-labelledby="my-subs" className="rounded-xl border border-line bg-surface p-5 sm:p-7">
      <h2 id="my-subs" className="text-[1.375rem] font-semibold">Work sent from your account</h2>
      <ul className="mt-3 divide-y divide-line">
        {visible.map((a) => <LegacyRow key={a.id} a={a} p={payments[a.id]} />)}
      </ul>
    </section>
  );
};

const LegacyRow: React.FC<{ a: Article; p?: SubmissionPayment }> = ({ a, p }) => {
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(a.content);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const canPay = p && ['awaiting', 'rejected'].includes(p.status);
  const statusCls = a.status === 'published' ? 'bg-navy-tint text-navy' : a.status === 'archived' ? 'bg-crimson/10 text-crimson' : 'bg-amber-tint text-ink';

  const claim = async () => {
    if (!p) return;
    setBusy(true);
    try { await claimPayment(p, note); setOpen(false); setMsg('Thank you. We will check the payment and let you know.'); } catch { setMsg('That did not work. Please try again.'); } finally { setBusy(false); }
  };
  const resubmit = async () => {
    setBusy(true);
    try {
      await updateDoc(doc(db, 'articles', a.id), { content: text.trim(), status: 'submitted', updatedAt: new Date().toISOString() });
      setEditing(false);
      setMsg('Sent back to the editorial team.');
    } catch { setMsg('Your changes could not be sent.'); } finally { setBusy(false); }
  };

  return (
    <li className="space-y-2 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p dir="auto" className="font-semibold">{a.title}</p>
          <p className="text-[0.8125rem] text-muted">{categoryOf(a.contentType) === 'video' ? 'Video' : 'Article'}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold ${statusCls}`}>{SUBMISSION_STATUS_LABEL[a.status] || a.status}</span>
      </div>
      {p && p.amountPence > 0 && (
        <p className="text-[0.875rem] text-ink-soft"><span>Fee</span> <span className="tabular-nums">{pounds(p.amountPence)}</span> · <span>reference</span> <strong className="ltr-value tabular-nums" translate="no">{p.reference}</strong> · <span>{PAYMENT_STATUS_LABEL[p.status]}</span></p>
      )}
      {a.status === 'published' && <a href={`/news/${encodeURIComponent(a.slug || a.id)}`} className="text-[0.9375rem] font-semibold text-navy underline">View it on the website</a>}
      {a.reviewerFeedback && ['changes_requested', 'archived'].includes(a.status) && <p className="rounded-lg bg-stone p-3 text-[0.9375rem]"><strong>From the editors:</strong> <span dir="auto" data-i18n-skip="">{a.reviewerFeedback}</span></p>}
      {canPay && (
        <div>
          <button type="button" onClick={() => setOpen((o) => !o)} className="cursor-pointer font-semibold text-navy underline">{open ? 'Hide payment details' : 'Payment details and “I have paid”'}</button>
          {open && (
            <div className="mt-3 space-y-3">
              <BankTransferDetails amount={pounds(p.amountPence)} reference={p.reference} compact />
              <label className="block text-[0.9375rem] font-semibold">When and how did you pay? <span className="font-normal text-muted">(optional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={field} />
              </label>
              <Button onClick={claim} disabled={busy}>I have paid</Button>
            </div>
          )}
        </div>
      )}
      {a.status === 'changes_requested' && (
        editing ? (
          <div className="space-y-2">
            <textarea dir="auto" rows={10} value={text} onChange={(e) => setText(e.target.value)} className={field} aria-label="Your text" />
            <div className="flex gap-3"><Button onClick={resubmit} disabled={busy}>Send back for review</Button><button type="button" onClick={() => setEditing(false)} className="cursor-pointer font-semibold underline">Cancel</button></div>
          </div>
        ) : <button type="button" onClick={() => setEditing(true)} className="cursor-pointer font-semibold text-navy underline">Make the changes</button>
      )}
      {msg && <p role="status" className="text-[0.875rem] text-navy">{msg}</p>}
    </li>
  );
};

