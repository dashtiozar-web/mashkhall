import React from 'react';
import { ArrowUpRight, Vote } from 'lucide-react';
import { Container } from './ui';

/** The Civil Referendum 2026 questionnaire. Answers are sent from its own page, straight to its source. */
export const REFERENDUM_URL = 'https://civil-referendum.pages.dev/';

/**
 * Invitation to the Civil Referendum on the home page, directly under the
 * cover so it is the first thing visitors see. The questionnaire opens on its
 * own page (in a new tab), where it is answered and submitted.
 */
export const ReferendumCall: React.FC = () => (
  <section aria-labelledby="referendum-heading" className="border-b border-[#F2C14E]/30 bg-[linear-gradient(100deg,#3A140C_0%,#5A1A0E_55%,#7A2414_100%)] text-white">
    <Container className="flex flex-col gap-6 py-8 sm:py-10 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-5">
        <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F2C14E] text-[#3A140C] sm:flex" aria-hidden="true">
          <Vote className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-semibold tracking-[0.12em] text-[#F2C14E] uppercase">Civil Referendum 2026</p>
          <h2 id="referendum-heading" className="mt-1 text-[1.625rem] leading-tight font-semibold text-white sm:text-[1.875rem]">
            Which option do you approve for the future governance of the Region?
          </h2>
          <p className="ku-sub mt-2 w-fit font-kurdish text-[1.25rem] leading-relaxed text-white/90" lang="ckb" dir="rtl" translate="no">
            ڕیفراندۆم: کام بژاردە بۆ حکومڕانیی داهاتووی هەرێم پەسەند دەکەیت؟
          </p>
          <p className="mt-2 max-w-[62ch] text-[0.9688rem] text-white/75">
            Answer every question on the referendum page. Your answers go directly to the referendum organisers. Available in Kurdish (Sorani and Badini), Arabic and English.
          </p>
        </div>
      </div>
      <a
        href={REFERENDUM_URL}
        target="_blank"
        rel="noopener"
        className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-[#F2C14E] px-7 py-4 text-[1.0625rem] font-bold text-[#2A110A] no-underline shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)] transition-colors hover:bg-[#FFD36B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:self-center"
      >
        Take part in the referendum
        <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </Container>
  </section>
);
