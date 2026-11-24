import React from 'react';
import { InstallApp } from './InstallApp';
import { Container, Logo, ORG_NAME } from './ui';
import { ViewModePicker } from './ViewMode';
import { DEFAULT_FACEBOOK_PAGE } from './FacebookFeed';

interface FooterProps {
  onNavigate: (tab: string, param?: string) => void;
}

const COLUMNS: { heading: string; links: { id: string; label: string }[] }[] = [
  {
    heading: 'Organisation',
    links: [
      { id: 'about', label: 'About us' },
      { id: 'history', label: 'Our history' },
      { id: 'memorial', label: '17 Shubat 2011 Memorial' },
      { id: 'sherwani', label: 'Sherwan Sherwani' },
      { id: 'structure', label: 'Our structure' },
      { id: 'activities', label: 'Our activities' },
      { id: 'appreciation', label: 'Appreciation' },
      { id: 'directory', label: 'Members' },
      { id: 'news', label: 'News and reports' },
    ],
  },
  {
    heading: 'Take part',
    links: [
      { id: 'apply', label: 'Become a member' },
      { id: 'donate', label: 'Support our work' },
      { id: 'contribute', label: 'Publish with us' },
      { id: 'resources', label: 'Resources' },
      { id: 'meetings', label: 'Online meetings (members)' },
      { id: 'member-dashboard', label: 'Member sign in' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { id: 'contact', label: 'Contact us' },
      { id: 'faqs', label: 'Questions' },
      { id: 'legal', label: 'Privacy and terms' },
    ],
  },
];

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => (
  <footer className="bg-band text-white/80">
    <div className="rule-fire" aria-hidden="true" />
    <Container className="py-12 sm:py-14">
      <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
        <div className="max-w-[40ch]">
          <div className="flex items-center gap-3">
            <Logo size={48} className="rounded-md ring-1 ring-white/20" />
            <p className="font-serif text-[1.375rem] leading-tight font-semibold text-white">{ORG_NAME}</p>
          </div>
          <p className="mt-5 text-[0.9688rem] leading-relaxed">
            An independent, non-violent human-rights organisation founded on 17 February 2015 by members of the
            Kurdish community in the United Kingdom.
          </p>
          <p className="mt-4 text-[0.9688rem] leading-relaxed">
            We are not affiliated with any government or political party.
          </p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h2 className="font-sans text-[0.8125rem] font-semibold tracking-[0.08em] text-[#F2C14E] uppercase">{col.heading}</h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(link.id)}
                      className="cursor-pointer text-start text-[0.9688rem] text-white/75 hover:text-white hover:underline"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="mt-10 flex flex-col gap-3 border-t border-white/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.9375rem] font-semibold text-white">Page layout</p>
        <ViewModePicker tone="dark" />
      </div>

      <InstallApp />

      <div className="mt-6 flex flex-col gap-3 border-t border-white/15 pt-6 text-[0.875rem] text-white/60 sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} {ORG_NAME}. Registered in England and Wales, company number 16809857. <a href="mailto:info@mashkhall.com" translate="no" className="ltr-value text-white/80 underline underline-offset-2 hover:text-white">info@mashkhall.com</a>. <a href={DEFAULT_FACEBOOK_PAGE} target="_blank" rel="noopener noreferrer" className="text-white/80 underline underline-offset-2 hover:text-white">Facebook</a></p>
        <p>Named after the peaceful protests that began in Sulaymaniyah on 17 February 2011.</p>
      </div>
    </Container>
  </footer>
);
