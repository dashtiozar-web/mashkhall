import React, { useEffect, useMemo, useRef, useState } from 'react';
import { authErrorMessage } from '../lib/authErrors';
import { ArrowLeft, Check, Camera, Eye, EyeOff, Pencil, X } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Button, Container, formatDate } from '../components/ui';
import { InvolvementPeriod, MemberApplication } from '../types';
import { DEPARTMENTS, departmentFor, positionById, positionsIn, positionTitle } from '../lib/positions';

const INVOLVEMENT_OPTIONS: { value: InvolvementPeriod; label: string }[] = [
  { value: 'new', label: 'No, I’m joining now' },
  { value: 'specific', label: 'Yes, I’m already a member' },
];

interface BecomeMemberPageProps {
  initialChapterId?: string;
  onNavigate: (tab: string, param?: string) => void;
  onOpenAuth: () => void;
}

const STEPS = ['Your name', 'Contact', 'Council and position', 'About you', 'Review'] as const;
type StepIndex = 0 | 1 | 2 | 3 | 4;

const field =
  'mt-2 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-[1.0625rem] font-normal text-ink placeholder:text-muted/80 focus:border-navy focus:ring-2 focus:ring-navy/20 focus:outline-none';
const labelCls = 'block text-[1rem] font-semibold text-ink';
const hintCls = 'mt-1.5 block text-[0.9375rem] font-normal text-muted';

/** Shrink a chosen photo to at most 360px so it stays small in the database. */
const downsamplePhoto = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not an image we can use.'));
      img.onload = () => {
        const max = 360;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not process that photo.'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

/* ------------------------------------------------------------------------ */
/* Status view after an application exists                                 */
/* ------------------------------------------------------------------------ */

const StatusView: React.FC<{
  app: MemberApplication;
  councilName: string;
  onEdit: () => void;
  onNavigate: (tab: string, param?: string) => void;
}> = ({ app, councilName, onEdit, onNavigate }) => {
  const s = app.status;
  const approved = s === 'approved';
  const changes = s === 'changes_requested';
  const rejected = s === 'rejected';
  const inReview = s === 'submitted' || s === 'under_review';

  const timeline: { title: string; body: string; state: 'done' | 'current' | 'todo' | 'stopped' }[] = [
    { title: 'Application received', body: `Sent on ${formatDate(app.createdAt) || 'today'}.`, state: 'done' },
    {
      title: 'Committee review',
      body: changes
        ? 'The committee has asked you to update your application.'
        : inReview
          ? 'Our membership committee is reading your application. This usually takes a few days.'
          : 'Reviewed by the membership committee.',
      state: approved || rejected ? 'done' : changes ? 'stopped' : 'current',
    },
    {
      title: approved ? 'Welcome to 17 Shubat' : 'Decision',
      body: approved
        ? 'Your membership is confirmed.'
        : rejected
          ? 'Your application was not accepted this time.'
          : 'You will see the decision here and in your account.',
      state: approved ? 'done' : rejected ? 'stopped' : 'todo',
    },
  ];

  return (
    <div className="mx-auto max-w-[44rem]">
      <div className={`rounded-3xl p-8 sm:p-10 ${approved ? 'bg-navy text-white' : 'border border-line bg-surface'}`}>
        <p className={`text-[0.9688rem] font-semibold ${approved ? 'text-amber' : 'text-navy'}`}>
          {approved ? 'Membership confirmed' : changes ? 'Action needed' : rejected ? 'Application closed' : 'Application in review'}
        </p>
        <h1 className={`mt-2 text-[2rem] leading-tight font-semibold sm:text-[2.5rem] ${approved ? 'text-white' : ''}`}>
          {approved
            ? `Welcome, ${app.displayName || app.fullName}`
            : changes
              ? 'Please update your application'
              : rejected
                ? 'Thank you for applying'
                : `Thank you, ${app.displayName || app.fullName}`}
        </h1>
        <p className={`mt-3 text-[1.0938rem] ${approved ? 'text-white/85' : 'text-ink-soft'}`}>
          {approved
            ? `You are now a member of the ${councilName} council. Your account is where you can edit your profile and write articles.`
            : changes
              ? 'The membership committee has a question or needs a little more information before deciding.'
              : rejected
                ? 'We were not able to accept your application this time. If you have questions, please get in touch.'
                : `We have your application for the ${councilName} council. You don’t need to do anything else for now.`}
        </p>

        {app.applicantFeedback && (changes || rejected) && (
          <blockquote className="mt-6 rounded-2xl border-s-4 border-amber bg-amber-tint px-5 py-4 text-ink">
            <p className="text-[0.875rem] font-semibold text-muted">Message from the committee</p>
            <p className="mt-1 whitespace-pre-line">{app.applicantFeedback}</p>
          </blockquote>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {approved && <Button variant="inverse" size="lg" onClick={() => onNavigate('member-dashboard')}>Go to your account</Button>}
          {changes && <Button size="lg" onClick={onEdit}>Update my application</Button>}
          {rejected && <Button size="lg" variant="secondary" onClick={() => onNavigate('contact')}>Contact us</Button>}
          {inReview && <Button size="lg" variant="secondary" onClick={() => onNavigate('member-dashboard')}>View in your account</Button>}
        </div>
      </div>

      <ol className="mt-10">
        {timeline.map((t, i) => (
          <li key={t.title} className="relative flex gap-4 pb-8 last:pb-0">
            {i < timeline.length - 1 && <span className="absolute top-9 start-[17px] h-[calc(100%-2.25rem)] w-0.5 bg-line" aria-hidden="true" />}
            <span
              className={`relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
                t.state === 'done'
                  ? 'border-navy bg-navy text-white'
                  : t.state === 'current'
                    ? 'border-navy bg-surface text-navy'
                    : t.state === 'stopped'
                      ? 'border-amber bg-amber-tint text-ink'
                      : 'border-line bg-surface text-muted'
              }`}
              aria-hidden="true"
            >
              {t.state === 'done' ? <Check className="h-4 w-4" /> : <span className="text-[0.875rem] font-semibold">{i + 1}</span>}
            </span>
            <div className="pt-1">
              <p className="font-semibold text-ink">{t.title}</p>
              <p className="mt-0.5 text-[0.9688rem] text-ink-soft">{t.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Application form                                                         */
/* ------------------------------------------------------------------------ */

export const BecomeMemberPage: React.FC<BecomeMemberPageProps> = ({ initialChapterId, onNavigate }) => {
  const { currentUser, userProfile, signUpWithEmail, signInWithEmail, sendPasswordReset } = useAuth();
  const { chapters, submitMembershipApplication } = useData();
  const councils = useMemo(() => chapters.filter((c) => !c.isArchived), [chapters]);

  const [existingApp, setExistingApp] = useState<MemberApplication | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState<StepIndex>(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Answers
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [displayTouched, setDisplayTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('United Kingdom');
  const [councilId, setCouncilId] = useState(initialChapterId || '');
  const [positionId, setPositionId] = useState('');
  const [reason, setReason] = useState('');
  const [skills, setSkills] = useState('');
  const [involvement, setInvolvement] = useState<InvolvementPeriod | ''>('');
  const [involvedSince, setInvolvedSince] = useState('');
  const [involvementNote, setInvolvementNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [haveAccount, setHaveAccount] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const prefilled = useRef(false);

  // Load an existing application once, and prefill from it or the account,
  // never overwriting something the applicant has already typed.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!currentUser) {
        setLoadingApp(false);
        return;
      }
      setLoadingApp(true);
      try {
        const snap = await getDoc(doc(db, 'applications', `app-${currentUser.uid}`));
        if (cancelled) return;
        const app = snap.exists() ? ({ ...(snap.data() as MemberApplication), id: snap.id }) : null;
        setExistingApp(app && app.status !== 'withdrawn' ? app : null);
        if (!prefilled.current) {
          prefilled.current = true;
          setEmail((v) => v || app?.email || currentUser.email || '');
          if (app) {
            setFullName((v) => v || app.fullName || '');
            setDisplayName((v) => v || app.displayName || '');
            setDisplayTouched(true);
            setPhone((v) => v || app.phone || '');
            setCountry(app.country || 'United Kingdom');
            setCouncilId((v) => v || app.chapterId || '');
            setPositionId((v) => v || app.positionId || '');
            setReason((v) => v || app.reason || '');
            setSkills((v) => v || app.skills || '');
            if (app.involvement) {
              // Older answers (a period such as "one to three years") become "already a member", needing a date.
              setInvolvement(app.involvement.period === 'new' ? 'new' : 'specific');
              setInvolvedSince(app.involvement.since || '');
              setInvolvementNote(app.involvement.note || '');
            }
            setPhotoUrl((v) => v || app.photoUrl || '');
          } else if (userProfile?.displayName) {
            setDisplayName((v) => v || userProfile.displayName);
            setDisplayTouched(true);
          }
        }
      } catch (e) {
        console.warn('Existing application check:', e);
      } finally {
        if (!cancelled) setLoadingApp(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  // If the chosen council isn't in the list (renamed, archived, or an old
  // link), don't pretend one is selected.
  useEffect(() => {
    if (councilId && councils.length > 0 && !councils.some((c) => c.id === councilId)) {
      const bySlug = councils.find((c) => c.slug === councilId);
      setCouncilId(bySlug ? bySlug.id : '');
    }
  }, [councils, councilId]);

  // Move focus to the step heading so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const validate = (s: StepIndex): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!fullName.trim()) e.fullName = 'Please enter your full name.';
      if (!displayName.trim()) e.displayName = 'Please choose a name to show publicly.';
    }
    if (s === 1) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Please enter a valid email address.';
      if (!country.trim()) e.country = 'Please tell us which country you live in.';
    }
    if (s === 2 && !councilId) e.council = 'Please choose the council nearest to you.';
    if (s === 2 && !positionById(positionId)) e.position = 'Please choose one position.';
    if (s === 3 && reason.trim().length < 20) e.reason = 'Please write a sentence or two (at least 20 characters).';
    if (s === 3 && !involvement) e.involvement = 'Please tell us whether you are already a member of 17 Shubat.';
    if (s === 3 && involvement !== 'new' && involvement && !involvedSince) e.involvement = 'Please give the date you became a member.';
    if (s === 3 && involvedSince && involvedSince > new Date().toISOString().slice(0, 10)) e.involvement = 'The date cannot be in the future.';
    if (s === 4) {
      if (!currentUser && password.length < 6) e.password = 'Your password needs at least 6 characters.';
      if (!agreed) e.agreed = 'Please confirm you agree to our principles to continue.';
    }
    return e;
  };

  const goTo = (s: StepIndex) => {
    setErrors({});
    setFormError(null);
    setStep(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const next = () => {
    const e = validate(step);
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    goTo(Math.min(4, step + 1) as StepIndex);
  };

  const choosePhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((e) => ({ ...e, photo: 'Please choose an image (PNG, JPG or WebP).' }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors((e) => ({ ...e, photo: 'That photo is larger than 10 MB. Please choose a smaller one.' }));
      return;
    }
    try {
      setPhotoUrl(await downsamplePhoto(file));
      setErrors(({ photo: _photo, ...rest }) => rest);
    } catch (err) {
      setErrors((e) => ({ ...e, photo: (err as Error).message }));
    }
  };

  const submit = async () => {
    // Re-check every step so nothing is skipped.
    for (const s of [0, 1, 2, 3, 4] as StepIndex[]) {
      const e = validate(s);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(s);
        return;
      }
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (!auth.currentUser || auth.currentUser.isAnonymous) {
        try {
          if (haveAccount) {
            await signInWithEmail(email.trim(), password);
          } else {
            await signUpWithEmail(email.trim(), password, displayName.trim());
          }
        } catch (err: any) {
          const code = err?.code || '';
          if (code === 'auth/email-already-in-use') {
            setHaveAccount(true);
            setErrors({ password: 'You already have an account with this email. Enter its password to continue.' });
          } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
            setErrors({ password: 'That password doesn’t match this email. Try again, or reset your password.' });
          } else if (code === 'auth/weak-password') {
            setErrors({ password: 'Please choose a stronger password (at least 6 characters).' });
          } else if (code === 'auth/invalid-email') {
            setErrors({ email: 'Please enter a valid email address.' });
            setStep(1);
          } else {
            setFormError(authErrorMessage(err, 'email'));
          }
          return;
        }
      }

      const uid = auth.currentUser?.uid;
      if (!uid) {
        setFormError('Please sign in to send your application.');
        return;
      }

      const answers = {
        userId: uid,
        fullName: fullName.trim(),
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        country: country.trim(),
        chapterId: councilId,
        positionId,
        reason: reason.trim(),
        skills: skills.trim(),
        photoUrl,
        agreedToPolicies: true,
        // Every approved member is listed publicly (organisation policy).
        consentToDirectory: true,
        involvement: {
          period: (involvement === 'new' || !involvement ? 'new' : 'specific') as InvolvementPeriod,
          ...(involvement !== 'new' && involvedSince ? { since: involvedSince } : {}),
          ...(involvementNote.trim() ? { note: involvementNote.trim().slice(0, 1000) } : {}),
        },
      };
      await submitMembershipApplication(answers);

      const now = new Date().toISOString();
      setExistingApp({
        ...answers,
        id: `app-${uid}`,
        status: 'submitted',
        createdAt: existingApp?.createdAt || now,
        updatedAt: now,
      });
      setEditing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Submit application error:', err);
      setFormError('Your application could not be sent. Check your connection and try again. Nothing has been submitted yet.');
    } finally {
      setSubmitting(false);
    }
  };

  const council = councils.find((c) => c.id === councilId);
  const councilName = council?.name || councils.find((c) => c.id === existingApp?.chapterId)?.name || 'your local';

  // ---------------------------------------------------------------- views

  if (loadingApp) {
    return (
      <Container narrow className="py-24 text-center text-muted" aria-busy="true">
        Loading your application…
      </Container>
    );
  }

  if (existingApp && !editing) {
    return (
      <section className="bg-stone">
        <Container className="py-14 sm:py-20">
          <StatusView
            app={existingApp}
            councilName={councilName}
            onNavigate={onNavigate}
            onEdit={() => { setEditing(true); setStep(0); }}
          />
        </Container>
      </section>
    );
  }

  const err = (k: string) =>
    errors[k] ? (
      <span role="alert" className="mt-2 block text-[0.9375rem] font-medium text-crimson">{errors[k]}</span>
    ) : null;

  return (
    <section className="min-h-[70vh] bg-stone">
      <Container className="py-10 sm:py-16">
        <div className="mx-auto max-w-[42rem]">
          {step === 0 && !editing && (
            <div className="mb-8 text-center">
              <p className="font-kurdish text-[1.5rem] text-navy" lang="ckb" dir="rtl">بەخێربێن</p>
              <h1 className="mt-1 text-[2.25rem] leading-tight font-semibold sm:text-[2.75rem]">Join 17 Shubat</h1>
              <p className="mx-auto mt-3 max-w-[36rem] text-[1.0938rem] text-ink-soft">
                It takes about five minutes. Our membership committee reviews every application, and your personal
                details are never published.
              </p>
            </div>
          )}

          {/* Progress */}
          <nav aria-label="Application progress" className="mb-6">
            <ol className="flex items-start gap-1.5">
              {STEPS.map((label, i) => (
                <li key={label} className="flex-1" aria-current={i === step ? 'step' : undefined}>
                  <span className={`block h-1.5 rounded-full ${i <= step ? 'bg-navy' : 'bg-stone-deep'}`} aria-hidden="true" />
                  <span className={`mt-2 hidden text-[0.8125rem] sm:block ${i === step ? 'font-semibold text-ink' : 'text-muted'}`}>
                    {label}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[0.875rem] text-muted sm:hidden">
              Step {step + 1} of {STEPS.length}: {STEPS[step]}
            </p>
          </nav>

          <form
            noValidate
            onSubmit={(e) => { e.preventDefault(); if (step < 4) next(); else submit(); }}
            className="rounded-3xl border border-line bg-surface p-6 shadow-[0_24px_60px_-40px_rgba(31,38,34,0.5)] sm:p-10"
          >
            {/* Step 1: name */}
            {step === 0 && (
              <div className="space-y-6">
                <h2 ref={headingRef} tabIndex={-1} className="text-[1.75rem] font-semibold outline-none">What’s your name?</h2>
                <label className={labelCls}>
                  Full name
                  <input
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (!displayTouched) setDisplayName(e.target.value.trim().split(/\s+/)[0] || '');
                    }}
                    className={field}
                    aria-invalid={Boolean(errors.fullName)}
                  />
                  <span className={hintCls}>As it appears on official documents. Only the membership committee sees this.</span>
                  {err('fullName')}
                </label>
                <label className={labelCls}>
                  What should we call you?
                  <input
                    autoComplete="nickname"
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); setDisplayTouched(true); }}
                    className={field}
                    aria-invalid={Boolean(errors.displayName)}
                  />
                  <span className={hintCls}>Shown on articles you write and, only if you agree, in our directory.</span>
                  {err('displayName')}
                </label>
              </div>
            )}

            {/* Step 2: contact */}
            {step === 1 && (
              <div className="space-y-6">
                <h2 ref={headingRef} tabIndex={-1} className="text-[1.75rem] font-semibold outline-none">
                  How can we reach you{displayName.trim() ? `, ${displayName.trim()}` : ''}?
                </h2>
                <label className={labelCls}>
                  Email address
                  <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} aria-invalid={Boolean(errors.email)} />
                  <span className={hintCls}>We’ll use this to tell you about your application.</span>
                  {err('email')}
                </label>
                <label className={labelCls}>
                  Phone number <span className="font-normal text-muted">(optional)</span>
                  <input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
                </label>
                <label className={labelCls}>
                  Country you live in
                  <input autoComplete="country-name" value={country} onChange={(e) => setCountry(e.target.value)} className={field} aria-invalid={Boolean(errors.country)} />
                  {err('country')}
                </label>
              </div>
            )}

            {/* Step 3: council */}
            {step === 2 && (
              <div className="space-y-5">
                <h2 ref={headingRef} tabIndex={-1} id="council-heading" className="text-[1.75rem] font-semibold outline-none">Which council is nearest to you?</h2>
                <p className="text-ink-soft">Councils are our local groups. You can change this later by contacting us.</p>
                {councils.length === 0 ? (
                  <p className="rounded-xl bg-stone p-4 text-ink-soft">The list of councils is loading. Please wait a moment.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="council-heading">
                    {councils.map((c) => {
                      const selected = c.id === councilId;
                      return (
                        <label
                          key={c.id}
                          className={`relative flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber ${
                            selected ? 'border-navy bg-navy-tint' : 'border-line hover:border-ink/30'
                          }`}
                        >
                          <input
                            type="radio"
                            name="council"
                            value={c.id}
                            checked={selected}
                            onChange={() => { setCouncilId(c.id); setErrors(({ council: _c, ...rest }) => rest); }}
                            className="sr-only"
                          />
                          <span
                            className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                              selected ? 'border-navy bg-navy text-white' : 'border-line bg-surface'
                            }`}
                            aria-hidden="true"
                          >
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <span>
                            <span className="block font-serif text-[1.25rem] font-semibold">{c.name}</span>
                            <span className="block text-[0.875rem] text-muted">{c.country}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="min-h-[1.5rem] text-[0.9688rem] text-ink-soft" aria-live="polite">
                  {council && <>You chose <strong className="text-ink">{council.name}</strong>.</>}
                </p>
                {err('council')}

                <div className="border-t border-line pt-6">
                  <label className={labelCls} htmlFor="position">
                    Position you hold or would like to take on
                  </label>
                  <p className="mt-1 text-[0.9375rem] text-muted">
                    Choose one. If you don’t hold a specific role, choose <strong className="font-semibold text-ink-soft">Member</strong>.
                    Positions are appointed by the committee; council positions are in your own council.
                  </p>
                  <select
                    id="position"
                    value={positionId}
                    onChange={(e) => { setPositionId(e.target.value); setErrors(({ position: _p, ...rest }) => rest); }}
                    className={field}
                    aria-invalid={Boolean(errors.position)}
                    aria-describedby={errors.position ? 'position-error' : undefined}
                  >
                    <option value="" disabled>Select a position…</option>
                    {DEPARTMENTS.map((d) => (
                      <optgroup key={d.id} label={d.id === 'council' ? 'Your council' : d.name}>
                        {positionsIn(d.id).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  {positionById(positionId) && (
                    <p className="mt-2 text-[0.9375rem] text-ink-soft">Part of: <strong className="text-ink">{departmentFor(positionId)?.id === 'council' ? 'your council' : departmentFor(positionId)?.name}</strong></p>
                  )}
                  {errors.position && <p id="position-error" className="mt-2 text-[0.9375rem] font-semibold text-crimson">{errors.position}</p>}
                </div>
              </div>
            )}

            {/* Step 4: about you */}
            {step === 3 && (
              <div className="space-y-7">
                <h2 ref={headingRef} tabIndex={-1} className="text-[1.75rem] font-semibold outline-none">Tell us a little about yourself</h2>
                <label className={labelCls}>
                  Why would you like to join?
                  <textarea
                    rows={5}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={field}
                    aria-invalid={Boolean(errors.reason)}
                    placeholder="A few sentences is plenty."
                  />
                  <span className={hintCls}>Only the membership committee reads this.</span>
                  {err('reason')}
                </label>
                <fieldset>
                  <legend className={labelCls}>Are you already a member of 17 Shubat Organization for Human Rights?</legend>
                  <p className="mt-1 text-[0.9375rem] font-normal text-muted">If you already hold a membership card or were a member before this website, tell us the date you became a member.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup">
                    {INVOLVEMENT_OPTIONS.map((o) => (
                      <label
                        key={o.value}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber ${
                          involvement === o.value ? 'border-navy bg-navy-tint' : 'border-line hover:border-ink/30'
                        }`}
                      >
                        <input
                          type="radio"
                          name="involvement"
                          value={o.value}
                          checked={involvement === o.value}
                          onChange={() => { setInvolvement(o.value); setErrors(({ involvement: _i, ...rest }) => rest); }}
                          className="sr-only"
                        />
                        <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${involvement === o.value ? 'border-navy bg-navy text-white' : 'border-line'}`} aria-hidden="true">
                          {involvement === o.value && <Check className="h-3 w-3" />}
                        </span>
                        <span className="font-normal">{o.label}</span>
                      </label>
                    ))}
                  </div>
                  {involvement && involvement !== 'new' && (
                    <>
                      <label className={`${labelCls} mt-4`}>
                        Date you became a member
                        <input type="date" value={involvedSince} max={new Date().toISOString().slice(0, 10)} onChange={(e) => { setInvolvedSince(e.target.value); setErrors(({ involvement: _i, ...rest }) => rest); }} className={field} />
                        <span className={hintCls}>If you don’t know the exact day, choose the first of the month.</span>
                      </label>
                      <label className={`${labelCls} mt-4`}>
                        Anything you’d like to add? <span className="font-normal text-muted">(optional)</span>
                        <input value={involvementNote} onChange={(e) => setInvolvementNote(e.target.value)} maxLength={1000} className={field} placeholder="For example: my card number is M0097206" />
                      </label>
                    </>
                  )}
                  <span className={hintCls}>
                    This date becomes your official joining date once the committee confirms it. New members’ joining date is the day they apply.
                  </span>
                  {err('involvement')}
                </fieldset>

                <label className={labelCls}>
                  Skills you could offer <span className="font-normal text-muted">(optional)</span>
                  <input value={skills} onChange={(e) => setSkills(e.target.value)} className={field} placeholder="For example: translation, research, organising events" />
                </label>

                <div>
                  <p className={labelCls}>Photo <span className="font-normal text-muted">(optional)</span></p>
                  <div className="mt-2 flex items-center gap-4">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Your photo" className="h-20 w-20 rounded-2xl object-cover" />
                    ) : (
                      <span className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-stone text-muted" aria-hidden="true">
                        <Camera className="h-7 w-7" />
                      </span>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center rounded-lg border border-ink/20 px-4 py-2 text-[0.9688rem] font-semibold hover:border-ink/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber">
                        {photoUrl ? 'Change photo' : 'Add a photo'}
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => choosePhoto(e.target.files?.[0])} />
                      </label>
                      {photoUrl && (
                        <button type="button" onClick={() => setPhotoUrl('')} className="cursor-pointer rounded-lg px-3 py-2 text-[0.9688rem] text-ink-soft hover:bg-stone">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <span className={hintCls}>Used on your member card, and in the directory only if you agree.</span>
                  {err('photo')}
                </div>
              </div>
            )}

            {/* Step 5: review */}
            {step === 4 && (
              <div className="space-y-7">
                <h2 ref={headingRef} tabIndex={-1} className="text-[1.75rem] font-semibold outline-none">Check your answers</h2>
                <dl className="divide-y divide-line rounded-2xl border border-line">
                  {[
                    { label: 'Name', value: `${fullName}${displayName && displayName !== fullName ? ` (shown as ${displayName})` : ''}`, step: 0 as StepIndex },
                    { label: 'Contact', value: [email, phone, country].filter(Boolean).join(', '), step: 1 as StepIndex },
                    { label: 'Council', value: council?.name || 'Not chosen', step: 2 as StepIndex },
                    { label: 'Position', value: positionById(positionId) ? `${positionTitle(positionId)} (${departmentFor(positionId)?.name})` : 'Not chosen', step: 2 as StepIndex },
                    { label: 'About you', value: reason, step: 3 as StepIndex },
                    { label: 'Member since', value: involvement === 'new' ? 'New member (joining now)' : involvedSince ? formatDate(involvedSince) : 'Not answered', step: 3 as StepIndex },
                  ].map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <dt className="text-[0.875rem] text-muted">{row.label}</dt>
                        <dd className="mt-0.5 line-clamp-3 break-words text-ink">{row.value}</dd>
                      </div>
                      <button
                        type="button"
                        onClick={() => goTo(row.step)}
                        className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-[0.9375rem] font-semibold text-navy hover:underline"
                        aria-label={`Change ${row.label.toLowerCase()}`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Change
                      </button>
                    </div>
                  ))}
                </dl>

                {!currentUser && (
                  <div className="rounded-2xl bg-stone p-5">
                    <p className="font-semibold text-ink">{haveAccount ? 'Sign in to your account' : 'Create a password'}</p>
                    <p className="mt-1 text-[0.9375rem] text-ink-soft">
                      {haveAccount ? `Enter the password for ${email}.` : `So you can follow your application. Your account email is ${email}.`}
                    </p>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={haveAccount ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${field} pe-12`}
                        aria-label="Password"
                        aria-invalid={Boolean(errors.password)}
                        placeholder={haveAccount ? 'Your password' : 'At least 6 characters'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute top-1/2 end-3 mt-1 -translate-y-1/2 cursor-pointer rounded-full p-1.5 text-muted hover:text-ink"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {err('password')}
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.9375rem]">
                      <button type="button" onClick={() => { setHaveAccount(!haveAccount); setErrors({}); }} className="cursor-pointer font-semibold text-navy hover:underline">
                        {haveAccount ? 'I’m new here' : 'I already have an account'}
                      </button>
                      {haveAccount && (
                        <button
                          type="button"
                          onClick={async () => {
                            try { await sendPasswordReset(email.trim()); setResetSent(true); }
                            catch { setErrors({ password: 'We couldn’t send a reset email. Check the address on the Contact step.' }); }
                          }}
                          className="cursor-pointer text-ink-soft hover:underline"
                        >
                          {resetSent ? 'Reset email sent' : 'Forgot password?'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--c-pine)]" />
                    <span className="text-ink">
                      I agree to 17 Shubat’s principles of non-violence and human rights, to being listed publicly as a member, and to the{' '}
                      <a href="/legal" target="_blank" rel="noopener" className="font-semibold text-navy underline underline-offset-4">terms of membership</a>.
                    </span>
                  </label>
                  {err('agreed')}
                  <div className="rounded-xl border border-line bg-stone p-4 text-[0.9688rem]">
                    <p className="font-semibold text-ink">Members are listed publicly</p>
                    <p className="mt-1 text-ink-soft">
                      Once approved, you will appear on our website with the name you chose to be shown under, your position,
                      department and council. Your email address, phone number and application answers are never published.
                      If being listed raises a safety concern for you, please <a href="/contact" className="font-semibold text-navy underline underline-offset-4">contact us</a> before applying.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {formError && <p role="alert" className="mt-6 rounded-xl border border-crimson/30 bg-crimson/5 px-4 py-3 text-crimson">{formError}</p>}

            <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
              {step > 0 ? (
                <button type="button" onClick={() => goTo((step - 1) as StepIndex)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 font-semibold text-ink-soft hover:bg-stone">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
                </button>
              ) : editing ? (
                <button type="button" onClick={() => setEditing(false)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 font-semibold text-ink-soft hover:bg-stone">
                  <X className="h-4 w-4" aria-hidden="true" /> Cancel
                </button>
              ) : (
                <span className="text-[0.9375rem] text-muted">
                  Already applied?{' '}
                  <button type="button" onClick={() => onNavigate('member-dashboard')} className="cursor-pointer font-semibold text-navy hover:underline">Check your status</button>
                </span>
              )}
              <Button type="submit" size="lg" disabled={submitting}>
                {step < 4
                  ? 'Continue'
                  : submitting
                    ? 'Sending…'
                    : editing
                      ? 'Send updated application'
                      : currentUser
                        ? 'Send application'
                        : haveAccount
                          ? 'Sign in and send'
                          : 'Create account and send'}
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-[0.9375rem] text-muted">
            Questions about joining? <a href="/faqs" className="font-semibold text-navy underline underline-offset-4">Read our answers</a> or{' '}
            <a href="/contact" className="font-semibold text-navy underline underline-offset-4">contact us</a>.
          </p>
        </div>
      </Container>
    </section>
  );
};
