import React, { useEffect, useState } from 'react';
import { Facebook } from 'lucide-react';
import { useData } from '../context/DataContext';
import { DEFAULT_FACEBOOK_PAGE, normaliseFacebookUrl } from '../components/FacebookFeed';

/** Where the Activities feed comes from: the organisation's Facebook Page. */
export const SocialSettings: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { siteSettings, updateSiteSettings } = useData();
  const [value, setValue] = useState(siteSettings.facebookPageUrl || DEFAULT_FACEBOOK_PAGE);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setValue(siteSettings.facebookPageUrl || DEFAULT_FACEBOOK_PAGE); }, [siteSettings.facebookPageUrl]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const raw = value.trim();
    if (raw && /facebook\.com\/share\//i.test(raw)) {
      setMsg({ ok: false, text: 'That is a share link, which Facebook does not allow on other websites. Open the link, then copy the Page’s own address from the browser bar (for example https://www.facebook.com/17shubat or https://www.facebook.com/profile.php?id=…).' });
      return;
    }
    const url = normaliseFacebookUrl(raw);
    if (raw && !url) {
      setMsg({ ok: false, text: 'Enter the address of a Facebook Page, starting with https://www.facebook.com/' });
      return;
    }
    setBusy(true);
    try {
      await updateSiteSettings({ facebookPageUrl: url });
      setMsg({ ok: true, text: url ? 'Saved. The Activities page and the home page now show posts from this Facebook Page.' : 'Removed. The activity feed is hidden.' });
    } catch (err) {
      console.error(err);
      setMsg({ ok: false, text: 'Could not save. Check that you are signed in as an administrator.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="social-heading" className="max-w-3xl rounded-xl border border-line bg-surface p-6">
      <h3 id="social-heading" className="flex items-center gap-2 font-serif text-lg font-bold text-ink">
        <Facebook className="h-5 w-5 text-[#1877F2]" aria-hidden="true" /> Activities from Facebook
      </h3>
      <p className="mt-1 text-[0.9375rem] text-ink-soft">
        Posts from this Facebook Page appear on the <button type="button" onClick={() => onNavigate('activities')} className="cursor-pointer font-semibold text-navy underline">Activities</button> page and on the home page, newest first. Anything you post on the Page later appears automatically.
        The Page must be public (no age or country restrictions).
      </p>
      <form onSubmit={save} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="fb-url" className="sr-only">Facebook Page address</label>
        <input id="fb-url" value={value} onChange={(e) => setValue(e.target.value)} inputMode="url" placeholder="https://www.facebook.com/your-page" className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3.5 py-2.5 focus:border-navy focus:outline-none" />
        <button type="submit" disabled={busy} className="cursor-pointer rounded-lg bg-navy px-5 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
      </form>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 rounded-lg px-3 py-2 text-[0.9375rem] ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}
    </section>
  );
};
