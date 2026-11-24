import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Button, Container, PageHeader, TextLink } from '../components/ui';

interface ContactPageProps {
  onNavigate: (tab: string, param?: string) => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigate }) => {
  const { submitContactEnquiry } = useData();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('General enquiry');
  const [message, setMessage] = useState('');
  const [privacyAgreed, setPrivacyAgreed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!privacyAgreed) {
      setError('Please confirm you have read the privacy policy.');
      return;
    }

    setSubmitting(true);
    try {
      await submitContactEnquiry({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || '',
        subject: subject.trim(),
        message: message.trim(),
        privacyAgreed: true,
      });

      setSuccess(true);
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
      setPrivacyAgreed(false);
    } catch (err: any) {
      console.error('Contact submit error:', err);
      setError('Your message could not be sent. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const field = 'mt-1.5 block w-full rounded-lg font-normal border border-line bg-surface px-3.5 py-2.5 text-[1rem] text-ink focus:border-navy focus:outline-none';
  const label = 'block text-[0.9688rem] font-semibold text-ink';

  return (
    <>
      <PageHeader
        title="Contact us"
        intro="Questions about membership, requests from journalists and partner organisations, or help with a situation you are facing. We read every message."
      />

      <Container className="grid gap-14 py-16 sm:py-20 lg:grid-cols-[1.5fr_1fr] lg:gap-20">
        <div>
          {success ? (
            <div className="border-t-4 border-navy bg-stone p-8" role="status">
              <h2 className="text-[1.75rem] font-semibold">Message sent</h2>
              <p className="mt-3 text-ink-soft">
                Thank you. A member of our team will reply to the email address you gave us.
              </p>
              <Button className="mt-6" variant="secondary" onClick={() => setSuccess(false)}>Send another message</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate={false}>
              <div className="grid gap-6 sm:grid-cols-2">
                <label className={label}>
                  Your name
                  <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={field} />
                </label>
                <label className={label}>
                  Email address
                  <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={field} />
                </label>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <label className={label}>
                  Phone <span className="font-normal text-muted">(optional)</span>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className={field} />
                </label>
                <label className={label}>
                  What is it about?
                  <select value={subject} onChange={(e) => setSubject(e.target.value)} className={field}>
                    <option>General enquiry</option>
                    <option>Membership</option>
                    <option>A council near me</option>
                    <option>Articles and research</option>
                    <option>Press or speaking request</option>
                    <option>Donations</option>
                    <option>Data request</option>
                  </select>
                </label>
              </div>
              <label className={label}>
                Your message
                <textarea required rows={7} value={message} onChange={(e) => setMessage(e.target.value)} className={field} />
              </label>
              <label className="flex items-start gap-3 text-[0.9688rem] text-ink-soft">
                <input type="checkbox" checked={privacyAgreed} onChange={(e) => setPrivacyAgreed(e.target.checked)} className="mt-1 h-4 w-4 accent-navy" />
                <span>
                  I have read the{' '}
                  <TextLink onClick={() => onNavigate('legal')} className="font-semibold">privacy policy</TextLink> and agree to
                  17 Shubat using these details to reply to me.
                </span>
              </label>
              {error && <p role="alert" className="border-s-4 border-crimson bg-crimson/5 px-4 py-3 text-[0.9688rem] text-ink">{error}</p>}
              <Button type="submit" size="lg" disabled={submitting}>{submitting ? 'Sending…' : 'Send message'}</Button>
            </form>
          )}
        </div>

        <aside className="space-y-10 self-start">
          <div className="border-s-4 border-crimson ps-5">
            <h2 className="font-sans text-[1.0625rem] font-semibold">If you are in danger</h2>
            <p className="mt-2 text-[0.9688rem] text-ink-soft">
              This form is not monitored around the clock. If you or someone else is in immediate danger in the UK,
              call 999.
            </p>
          </div>
          <div>
            <h2 className="font-sans text-[1.0625rem] font-semibold">Keep sensitive details for later</h2>
            <p className="mt-2 text-[0.9688rem] text-ink-soft">
              Please don’t include sensitive personal information in your first message. Tell us briefly what it is
              about and we will arrange a safer way to talk.
            </p>
          </div>
          <div>
            <h2 className="font-sans text-[1.0625rem] font-semibold">Common questions</h2>
            <p className="mt-2 text-[0.9688rem] text-ink-soft">
              Many questions about membership and privacy are answered on our{' '}
              <TextLink onClick={() => onNavigate('faqs')}>questions page</TextLink>.
            </p>
          </div>
        </aside>
      </Container>
    </>
  );
};
