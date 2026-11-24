import React from 'react';
import { Container, PageHeader, TextLink } from '../components/ui';

interface LegalPageProps {
  onNavigate: (tab: string, param?: string) => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mt-10 first:mt-0">
    <h3 className="text-[1.375rem] font-semibold">{title}</h3>
    <div className="mt-3 space-y-4 text-[1.0313rem] leading-relaxed text-ink-soft">{children}</div>
  </section>
);

export const LegalPage: React.FC<LegalPageProps> = ({ onNavigate }) => (
  <>
    <PageHeader
      title="Privacy and terms"
      intro="How we protect the people who work with us, and what we ask of our members."
    >
      <a href="#privacy" onClick={(e) => { e.preventDefault(); document.getElementById('privacy')?.scrollIntoView(); }} className="font-semibold text-navy underline underline-offset-4">Privacy policy</a>
      <a href="#terms" onClick={(e) => { e.preventDefault(); document.getElementById('terms')?.scrollIntoView(); }} className="font-semibold text-navy underline underline-offset-4">Terms</a>
    </PageHeader>

    <Container narrow className="py-10 sm:py-14">
      <div id="privacy" className="scroll-mt-28">
        <h2 className="mb-8 text-[2rem] font-semibold">Privacy policy</h2>
        <Section title="Why privacy matters to us">
          <p>
            People who speak up about human rights can face serious risks, in the UK and elsewhere. We collect only
            the information we need to process membership and provide support, and we protect it carefully.
          </p>
        </Section>
        <Section title="What we collect and who can see it">
          <p>
            When you apply for membership you give us your legal name, email address, an optional phone number and
            your answers to the application. <strong className="text-ink">This information is never published, sold or shared with
            commercial organisations.</strong>
          </p>
          <p>
            Only our membership reviewers and administrators can see it, and they are bound by confidentiality.
          </p>
        </Section>
        <div id="safety" className="scroll-mt-28">
        <Section title="Your safety online">
          <p>
            We report on human-rights abuses in Iran, Iraq and Kurdistan. Governments and others may try to watch who
            reads or writes for sites like ours. <strong className="text-ink">We cannot promise anonymity, and we cannot tell whether your
            connection is being watched.</strong> If you could be at risk:
          </p>
          <ul className="list-disc space-y-1.5 ps-6">
            <li>Consider using the Tor Browser or a trustworthy VPN to visit and to send work. Our visitor statistics then show the VPN’s country, not yours.</li>
            <li>Do not use your real name, a work email or a phone number linked to you if that could endanger you. A pseudonym is fine for contributors.</li>
            <li>Check photos and videos before sending: faces, voices, uniforms, number plates, street signs, buildings and the view from a window can identify you or the people around you. We remove GPS and camera details from photos uploaded here, but not from videos on YouTube or Facebook.</li>
            <li>Use a device and accounts that others cannot open, sign out afterwards, and keep your device up to date.</li>
            <li>If you think you have been identified because of something on this website, <TextLink onClick={() => onNavigate('contact')}>contact us</TextLink> and we will help remove it.</li>
          </ul>
        </Section>
        </div>
        <Section title="Publishing with us and fees">
          <p>
            Anyone can send work through Publish with Us without creating an account. We ask for your name (published
            with your work), your email address and, if you wish, a phone number and country, so that the editors can
            contact you. Your email and phone number are never published. Your browser receives a temporary sign-in so
            that our database can limit how often work is sent; this is not an account and keeps nothing about you.
          </p>
          <p>
            You receive a private tracking link. Anyone who has the link can see the status of that submission, so keep
            it to yourself. This browser also remembers your submissions until you choose “Forget on this device”.
          </p>
          <p>
            Visitors pay a publication fee when they send their work, before editorial review; members do not, and may give a
            voluntary contribution. To apply discounts, we count your published work under a one-way code made from your email
            address. Fees and contributions never affect editorial decisions or mean we endorse an author’s views.
            Payment details are seen only by the contributor and our editorial and finance administrators, and are never
            shown with published work. We keep payment records for six years, as financial records, and delete rejected,
            withdrawn or cancelled submissions after twelve months.
          </p>
          <p>
            Sending or publishing work never makes you a member of the organisation: contributors are not added to the
            membership register and receive no position, membership number or card.
          </p>
        </Section>
        <Section title="Visitor statistics">
          <p>
            Each time someone opens the website, we count the visit by country and day (and, for Iraq and Iran, whether
            it is in a Kurdish region). Our hosting provider, Cloudflare, estimates the country from the connection;
            VPNs, proxies and mobile networks can place people in the wrong country. We keep only the totals. The totals
            per country are shown publicly on the homepage; administrators can also see members and visitors separately.
          </p>
          <p>
            <strong className="text-ink">We do not store or publish IP addresses.</strong> To count each person once a day, a one-way
            code is made from the connection with a key that changes every day, and the codes are deleted the next day.
            Figures for the Kurdish regions smaller than five are hidden. Security counts (such as failed sign-ins), kept
            by day, type and country only, are deleted after 90 days.
          </p>
        </Section>
        <Section title="Members are listed publicly">
          <p>
            Once your membership is approved, you are listed on this website as a member of Mashkhally Zhyanawa. Your public
            profile shows:
          </p>
          <ul className="list-disc space-y-1.5 ps-6">
            <li>the name you choose to be shown under, and your photo if you add one;</li>
            <li>your position and department in the organisation, and your council;</li>
            <li>your membership number and whether your membership card is valid;</li>
            <li>anything you add yourself, such as a short biography or areas of expertise.</li>
          </ul>
          <p>
            Your legal name (if different), email address, phone number and application answers are never published.
            If you have a safety concern about being listed, please <TextLink onClick={() => onNavigate('contact')}>contact us</TextLink> before
            applying or at any time, and we will discuss it with you.
          </p>
        </Section>
        <Section title="Deleting your data">
          <p>
            You can ask us to delete your account, your application and any drafts at any time.{' '}
            <TextLink onClick={() => onNavigate('contact')}>Contact us</TextLink> with the subject “Data request”.
            You can also withdraw a pending application yourself from your account.
          </p>
        </Section>
      </div>

      <div id="terms" className="mt-14 scroll-mt-28 border-t border-line pt-12">
        <h2 className="mb-8 text-[2rem] font-semibold">Terms of membership and publication</h2>
        <Section title="Our principles">
          <p>
            By applying for or holding membership, you commit to universal human rights, democratic values,
            transparency and strictly peaceful methods. We reject violent extremism, sectarian discrimination,
            harassment and hate speech in every form.
          </p>
        </Section>
        <Section title="Articles and contributions">
          <p>
            Members are welcome to submit articles, reports and commentary. Every submission is reviewed by our
            editors before publication. Plagiarism, defamatory allegations and unverified claims are not accepted.
            Changes to a published article are reviewed again before they go live.
          </p>
        </Section>
        <Section title="Publication terms for contributors">
          <p>
            When you send work through Publish with Us, you confirm that it is your own work or that you have permission
            to share it, and you give Mashkhally Zhyanawa permission to publish it on this website and share it on our channels
            under your name. You keep your copyright.
          </p>
          <p>
            The publication fee is shown before you send your work and paid by bank transfer before editorial review
            starts. The editors may ask for changes or decide not to publish; if your work is not accepted, we refund the
            fee. Paying does not guarantee publication or mean that Mashkhally Zhyanawa endorses your views. You can withdraw your
            submission before you pay; after paying, contact us to withdraw it and receive a refund.
          </p>
          <p>
            Your work is published in the language you wrote it in and is never translated automatically. Contributors are
            independent authors and are not members of the organisation.
          </p>
        </Section>
        <Section title="Donations">
          <p>
            Donations are used for the organisation’s running costs, community events, translation and our archive.
            We will never ask you for a banking password, card PIN or any other confidential credential.
          </p>
        </Section>
        <Section title="Governance">
          <p>
            Public titles within the organisation do not in themselves grant administrative access to this website.
            Administrative and financial roles are assigned by the board.
          </p>
        </Section>
      </div>
    </Container>
  </>
);
