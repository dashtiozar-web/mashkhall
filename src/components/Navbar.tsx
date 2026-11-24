import React, { useEffect, useRef, useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Container, Logo, ORG_SHORT } from './ui';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './Notifications';
import { LanguageSwitcher } from './LanguageSwitcher';

interface NavbarProps {
  currentTab: string;
  onNavigate: (tab: string, param?: string) => void;
  onOpenAuth: () => void;
}

const NAV_LINKS: { id: string; label: string; activeFor: string[] }[] = [
  { id: 'about', label: 'About', activeFor: ['about', 'history'] },
  { id: 'memorial', label: '17 Shubat 2011 Memorial', activeFor: ['memorial'] },
  { id: 'activities', label: 'Activities', activeFor: ['activities', 'activity'] },
  { id: 'appreciation', label: 'Appreciation', activeFor: ['appreciation'] },
  { id: 'structure', label: 'Structure', activeFor: ['structure'] },
  { id: 'news', label: 'News and reports', activeFor: ['news', 'article', 'resources'] },
  { id: 'videos', label: 'Videos', activeFor: ['videos'] },
  { id: 'directory', label: 'Councils', activeFor: ['directory', 'chapter', 'member-profile'] },
  { id: 'contact', label: 'Contact', activeFor: ['contact', 'faqs'] },
];

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onNavigate, onOpenAuth }) => {
  const { currentUser, userProfile, isAdmin, isMember, hasPermission, signOut } = useAuth();
  const canManageNotifications = Boolean(currentUser) && hasPermission('manage_notifications');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const go = (tab: string, param?: string) => {
    onNavigate(tab, param);
    setMobileOpen(false);
    setAccountOpen(false);
  };

  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAccountOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountOpen]);

  const displayName = userProfile?.displayName || currentUser?.email?.split('@')[0] || 'Account';
  const menuItem = 'block w-full cursor-pointer rounded-lg px-3 py-2 text-start text-[0.9688rem] text-ink hover:bg-stone';
  const iconBtns = '[&>button]:text-white/85 [&>button:hover]:bg-white/10 [&>button:hover]:text-white [&>div>button]:text-white/85 [&>div>button:hover]:bg-white/10 [&>div>button:hover]:text-white';

  return (
    <>
    {/* Top bar: language and a short statement of who we are. */}
    <div className="border-b border-white/10 bg-[#120906] text-white">
      <Container className="flex h-10 items-center justify-between gap-3">
        <p className="hidden truncate text-[0.8125rem] text-white/65 sm:block">Independent · Non-violent · Founded 17 February 2015</p>
        <LanguageSwitcher className="ms-auto" />
      </Container>
    </div>
    <header className="sticky top-0 z-50 bg-band text-white shadow-[0_1px_0_rgba(255,255,255,0.06),0_8px_24px_-16px_rgba(0,0,0,0.6)]">
      <Container>
        <div className="flex h-[68px] items-center justify-between gap-4">
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); go('home'); }}
            className="flex shrink-0 items-center gap-3 no-underline"
          >
            <Logo size={42} className="rounded-md ring-1 ring-white/20" />
            <span className="leading-tight">
              <span className="block font-serif text-[1.1875rem] font-semibold text-white">{ORG_SHORT}</span>
              <span className="block w-fit font-kurdish text-[0.875rem] text-white/70" lang="ckb" dir="rtl" translate="no">مەشخەڵی ژیانەوە</span>
            </span>
          </a>

          <nav aria-label="Main" className="hidden min-[1680px]:block">
            <ul className="flex items-center gap-0.5">
              {NAV_LINKS.map((link) => {
                const active = link.activeFor.includes(currentTab);
                return (
                  <li key={link.id}>
                    <button
                      type="button"
                      onClick={() => go(link.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`relative cursor-pointer px-2 py-2 whitespace-nowrap text-[0.9063rem] font-medium transition-colors after:absolute after:inset-x-2 after:-bottom-[13px] after:h-[3px] after:rounded-full ${
                        active ? 'text-white after:bg-ember' : 'text-white/75 hover:text-white after:bg-transparent hover:after:bg-white/30'
                      }`}
                    >
                      {link.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className={`flex items-center gap-1 sm:gap-2 ${iconBtns}`}>
            <NotificationBell onNavigate={(t) => go(t)} />
            <ThemeToggle />

            <div className="hidden items-center gap-2 ps-1 min-[1680px]:flex">
              <button
                type="button"
                onClick={() => go('donate')}
                className="cursor-pointer rounded-lg border border-white/30 px-4 py-2 text-[0.9375rem] font-semibold whitespace-nowrap text-white hover:border-white hover:bg-white/5"
              >
                Donate
              </button>
              {!isMember && (
                <button
                  type="button"
                  onClick={() => go('apply')}
                  className="cursor-pointer rounded-lg bg-crimson px-4 py-2 text-[0.9375rem] font-semibold whitespace-nowrap text-white hover:brightness-110"
                >
                  Join us
                </button>
              )}

              {currentUser ? (
                <div className="relative" ref={accountRef}>
                  <button
                    type="button"
                    onClick={() => setAccountOpen(!accountOpen)}
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg py-2 pe-2 ps-3 text-[0.9375rem] font-medium text-white/85 hover:bg-white/10 hover:text-white"
                  >
                    <span className="max-w-[10ch] truncate" translate="no" data-i18n-skip="">{displayName}</span>
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {accountOpen && (
                    <div role="menu" className="absolute end-0 mt-2 w-64 rounded-xl border border-line bg-surface p-2 text-ink shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)]">
                      <p className="ltr-value truncate px-3 pt-1 pb-2 text-sm text-muted" translate="no" data-i18n-skip="">{currentUser.email}</p>
                      <button role="menuitem" type="button" onClick={() => go('member-dashboard')} className={menuItem}>Your account</button>
                      {isMember && <button role="menuitem" type="button" onClick={() => go('meetings')} className={menuItem}>Online meetings</button>}
                      {canManageNotifications && (
                        <button role="menuitem" type="button" onClick={() => go('notifications')} className={menuItem}>Manage notifications</button>
                      )}
                      {isAdmin && (
                        <button role="menuitem" type="button" onClick={() => go('admin-dashboard')} className={menuItem}>Administration</button>
                      )}
                      <div className="my-1 border-t border-line" />
                      <button role="menuitem" type="button" onClick={() => { signOut(); go('home'); }} className={`${menuItem} text-ink-soft`}>
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="cursor-pointer rounded-lg px-3 py-2 text-[0.9375rem] font-medium whitespace-nowrap text-ink-soft hover:bg-stone hover:text-ink"
                >
                  Sign in
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              className="-me-1 cursor-pointer rounded-lg p-2 text-white hover:bg-white/10 min-[1680px]:hidden"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </Container>

      {mobileOpen && (
        <div id="mobile-menu" className="max-h-[calc(100dvh-68px)] overflow-y-auto border-t border-white/10 bg-surface text-ink min-[1680px]:hidden">
          <Container className="py-4">
            <LanguageSwitcher tone="light" className="mb-3" />
            <ul className="divide-y divide-line">
              {[{ id: 'home', label: 'Home', activeFor: ['home'] }, ...NAV_LINKS.flatMap((l) => (l.id === 'memorial' ? [l, { id: 'sherwani', label: 'Sherwan Sherwani', activeFor: ['sherwani'] }] : [l])), ...(isMember ? [{ id: 'meetings', label: 'Online meetings', activeFor: ['meetings', 'meeting'] }] : []), ...(currentUser ? [{ id: 'notifications', label: 'Notifications', activeFor: ['notifications'] }] : [])].map((link) => (
                <li key={link.id}>
                  <button
                    type="button"
                    onClick={() => go(link.id)}
                    aria-current={link.activeFor.includes(currentTab) ? 'page' : undefined}
                    className={`block w-full cursor-pointer py-3 text-start font-serif text-[1.1875rem] ${link.activeFor.includes(currentTab) ? 'font-semibold text-navy' : 'text-ink'}`}
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => go('donate')} className="cursor-pointer rounded-lg border border-ink/25 py-3 font-semibold">
                Donate
              </button>
              {!isMember ? (
                <button type="button" onClick={() => go('apply')} className="cursor-pointer rounded-lg bg-crimson py-3 font-semibold text-white">
                  Join us
                </button>
              ) : (
                <button type="button" onClick={() => go('member-dashboard')} className="cursor-pointer rounded-lg bg-navy py-3 font-semibold text-white">
                  Your account
                </button>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-[0.9375rem]">
              {currentUser ? (
                <>
                  {!isMember && (
                    <button type="button" onClick={() => go('member-dashboard')} className="cursor-pointer font-medium text-navy">Your account</button>
                  )}
                  {canManageNotifications && (
                    <button type="button" onClick={() => go('notifications')} className="cursor-pointer font-medium text-navy">Manage notifications</button>
                  )}
                  {isAdmin && (
                    <button type="button" onClick={() => go('admin-dashboard')} className="cursor-pointer font-medium text-navy">Administration</button>
                  )}
                  <button type="button" onClick={() => { signOut(); go('home'); }} className="cursor-pointer text-ink-soft">Sign out</button>
                </>
              ) : (
                <button type="button" onClick={() => { setMobileOpen(false); onOpenAuth(); }} className="cursor-pointer font-medium text-navy">
                  Member sign in
                </button>
              )}
            </div>
          </Container>
        </div>
      )}
    </header>
    </>
  );
};
