import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { NotificationPopup } from './components/Notifications';
import { BreakingNewsBanner } from './components/BreakingNewsBanner';
import { recordVisit } from './lib/visits';
import { AppSplash } from './components/AppSplash';
import { ContributePage } from './pages/ContributePage';
import { useAuth } from './context/AuthContext';
import { ViewModeProvider } from './components/ViewMode';
import { currentPath, navigateTo, ROUTE_EVENT } from './lib/router';
import { NotificationsProvider } from './context/NotificationsContext';
import { NotificationsPage } from './pages/NotificationsPage';
import { VerifyPage } from './pages/VerifyPage';
import { IdCheckPage } from './pages/IdCheckPage';

// Pages
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { DirectoryPage } from './pages/DirectoryPage';
import { ChapterDetailPage } from './pages/ChapterDetailPage';
import { MemberProfilePage } from './pages/MemberProfilePage';
import { StructurePage } from './pages/StructurePage';
import { MeetingsPage } from './pages/MeetingsPage';
import { AppreciationPage } from './pages/AppreciationPage';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { ActivityDetailPage } from './pages/ActivityDetailPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { NewsPage } from './pages/NewsPage';
import { VideosPage } from './pages/VideosPage';
import { ArticleDetailPage } from './pages/ArticleDetailPage';
import { DonatePage } from './pages/DonatePage';
import { ContactPage } from './pages/ContactPage';
import { FaqsPage } from './pages/FaqsPage';
import { BecomeMemberPage } from './pages/BecomeMemberPage';
import { MemberDashboardPage } from './pages/MemberDashboardPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { LegalPage } from './pages/LegalPage';

// ---------------------------------------------------------------------------
// Routing: each page has its own shareable address (e.g. #/news/my-article),
// and the browser's back and forward buttons work. Hash routing needs no
// server configuration on Cloudflare Pages.
// ---------------------------------------------------------------------------

const TAB_TO_PATH: Record<string, string> = {
  home: '',
  about: 'about',
  history: 'about',
  directory: 'people',
  chapter: 'councils',
  'member-profile': 'people',
  resources: 'resources',
  news: 'news',
  article: 'news',
  videos: 'videos',
  donate: 'donate',
  contact: 'contact',
  faqs: 'faqs',
  apply: 'join',
  'member-dashboard': 'account',
  'admin-dashboard': 'admin',
  legal: 'legal',
  notifications: 'notifications',
  verify: 'verify',
  'id-check': 'id',
  structure: 'structure',
  activities: 'activities',
  activity: 'activities',
  contribute: 'contribute',
  meetings: 'meetings',
  meeting: 'meetings',
  appreciation: 'appreciation',
  'appreciation-letter': 'appreciation',
};

const PATH_TO_TAB: Record<string, [string, string]> = {
  // path -> [tab without param, tab with param]
  '': ['home', 'home'],
  about: ['about', 'about'],
  // Earlier pages now lead to About.
  history: ['about', 'about'],
  memorial: ['about', 'about'],
  'sherwan-sherwani': ['about', 'about'],
  people: ['directory', 'member-profile'],
  councils: ['directory', 'chapter'],
  chapters: ['directory', 'chapter'], // old links keep working
  resources: ['resources', 'resources'],
  news: ['news', 'article'],
  videos: ['videos', 'videos'],
  donate: ['donate', 'donate'],
  contact: ['contact', 'contact'],
  faqs: ['faqs', 'faqs'],
  join: ['apply', 'apply'],
  account: ['member-dashboard', 'member-dashboard'],
  admin: ['admin-dashboard', 'admin-dashboard'],
  legal: ['legal', 'legal'],
  notifications: ['notifications', 'notifications'],
  verify: ['verify', 'verify'],
  id: ['verify', 'id-check'],
  structure: ['structure', 'structure'],
  activities: ['activities', 'activity'],
  contribute: ['contribute', 'contribute'],
  meetings: ['meetings', 'meeting'],
  appreciation: ['appreciation', 'appreciation-letter'],
};

const PAGE_TITLES: Record<string, string> = {
  contribute: 'Publish with us',
  about: 'About us',
  directory: 'Members and people',
  chapter: 'Members by place',
  'member-profile': 'Member',
  resources: 'Resources',
  news: 'News and reports',
  videos: 'Videos',
  article: 'Article',
  donate: 'Support our work',
  contact: 'Contact us',
  faqs: 'Questions',
  apply: 'Become a member',
  'member-dashboard': 'Your account',
  'admin-dashboard': 'Administration',
  legal: 'Privacy and terms',
  notifications: 'Notifications',
  verify: 'Verify a membership',
  'id-check': 'Membership verification',
  structure: 'Our structure',
  activities: 'Our activities',
  activity: 'Activity',
  meetings: 'Online meetings',
  meeting: 'Online meeting',
  appreciation: 'Appreciation',
  'appreciation-letter': 'Letter of Appreciation',
};

export const pathFor = (tab: string, param?: string) => {
  const base = TAB_TO_PATH[tab] ?? tab;
  const parts = [base, param].filter(Boolean).map(p => encodeURIComponent(p as string));
  return '/' + parts.join('/').replace(/^home$/, '');
};

/** "/people/M0097206?r=x" → { tab: 'member-profile', param: 'M0097206?r=x' } */
const parseRoute = (url: string): { tab: string; param?: string } => {
  const [path, query] = url.split('?');
  const clean = path.replace(/^\/+|\/+$/g, '');
  const [first = '', ...rest] = clean.split('/').map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  let param = rest.join('/') || undefined;
  if (param && query) param = `${param}?${query}`;
  const entry = PATH_TO_TAB[first];
  if (!entry) return { tab: 'home' };
  return { tab: param ? entry[1] : entry[0], param };
};

const AppContent: React.FC = () => {
  const initial = parseRoute(typeof window !== 'undefined' ? currentPath() : '/');
  const [currentTab, setCurrentTab] = useState<string>(initial.tab);
  const [currentParam, setCurrentParam] = useState<string | undefined>(initial.param);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const { currentUser, loading: authLoading } = useAuth();

  // Count this visit (by country only), once the sign-in state is known.
  useEffect(() => {
    if (!authLoading) recordVisit(Boolean(currentUser));
  }, [authLoading, currentUser?.uid]);

  useEffect(() => {
    const onRoute = () => {
      const next = parseRoute(currentPath());
      setCurrentTab(next.tab);
      setCurrentParam(next.param);
      window.scrollTo({ top: 0 });
    };
    // Internal links (<a href="/about">) change the page without reloading.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const href = a.getAttribute('href') || '';
      if (!(href.startsWith('/') || href.startsWith('#/')) || href.startsWith('//')) return;
      e.preventDefault();
      navigateTo(href);
    };
    window.addEventListener('popstate', onRoute);
    window.addEventListener('hashchange', onRoute);
    window.addEventListener(ROUTE_EVENT, onRoute);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('popstate', onRoute);
      window.removeEventListener('hashchange', onRoute);
      window.removeEventListener(ROUTE_EVENT, onRoute);
      document.removeEventListener('click', onClick);
    };
  }, []);

  useEffect(() => {
    const title = PAGE_TITLES[currentTab];
    document.title = title ? `${title} | Mashkhally Zhyanawa` : 'Mashkhally Zhyanawa Organisation';
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', `${window.location.origin}${window.location.pathname}`);
    // Members' own pages, QR checks and private areas stay out of search results.
    const privatePage = ['member-profile', 'verify', 'id-check', 'member-dashboard', 'admin-dashboard', 'notifications', 'meetings', 'meeting'].includes(currentTab)
      || (currentTab === 'contribute' && Boolean(currentParam));
    let robots = document.querySelector('meta[name="robots"]');
    if (privatePage && !robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    if (robots) robots.setAttribute('content', privatePage ? 'noindex, nofollow' : 'index, follow');
  }, [currentTab, currentParam]);

  const handleNavigate = (tab: string, param?: string) => {
    const target = pathFor(tab, param);
    if (window.location.pathname === target) {
      window.scrollTo({ top: 0 });
      return;
    }
    navigateTo(target);
  };

  const handleOpenAuth = (mode: 'signin' | 'signup' | 'reset' = 'signin') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink antialiased">
      <a
        href="#main"
        onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[100] focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:shadow"
      >
        Skip to content
      </a>

      <AppSplash />
      <BreakingNewsBanner />

      <Navbar 
        currentTab={currentTab} 
        onNavigate={handleNavigate} 
        onOpenAuth={() => handleOpenAuth('signin')} 
      />

      <NotificationPopup />

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {currentTab === 'home' && (
          <HomePage onNavigate={handleNavigate} onOpenAuth={() => handleOpenAuth('signin')} />
        )}

        {currentTab === 'about' && (
          <AboutPage onNavigate={handleNavigate} />
        )}

        {currentTab === 'directory' && (
          <DirectoryPage onNavigate={handleNavigate} />
        )}

        {currentTab === 'chapter' && (
          <ChapterDetailPage slug={currentParam || 'britain'} onNavigate={handleNavigate} />
        )}

        {currentTab === 'member-profile' && (
          <MemberProfilePage memberId={currentParam || ''} onNavigate={handleNavigate} />
        )}

        {currentTab === 'resources' && (
          <ResourcesPage onNavigate={handleNavigate} />
        )}

        {currentTab === 'news' && (
          <NewsPage onNavigate={handleNavigate} />
        )}

        {currentTab === 'videos' && <VideosPage onNavigate={handleNavigate} />}

        {currentTab === 'article' && (
          <ArticleDetailPage slug={currentParam || ''} onNavigate={handleNavigate} onOpenAuth={() => handleOpenAuth('signin')} />
        )}

        {currentTab === 'donate' && (
          <DonatePage onNavigate={handleNavigate} />
        )}

        {currentTab === 'contact' && (
          <ContactPage onNavigate={handleNavigate} />
        )}

        {currentTab === 'faqs' && (
          <FaqsPage onNavigate={handleNavigate} />
        )}

        {currentTab === 'contribute' && <ContributePage key={currentParam || 'form'} param={currentParam} onNavigate={handleNavigate} onOpenAuth={(m) => handleOpenAuth(m || 'signin')} />}
        {currentTab === 'apply' && (
          <BecomeMemberPage 
            initialChapterId={currentParam} 
            onNavigate={handleNavigate} 
            onOpenAuth={() => handleOpenAuth('signup')} 
          />
        )}

        {currentTab === 'member-dashboard' && (
          <MemberDashboardPage 
            initialTab={currentParam}
            onNavigate={handleNavigate} 
            onOpenAuth={() => handleOpenAuth('signin')} 
          />
        )}

        {currentTab === 'admin-dashboard' && (
          <AdminDashboardPage 
            onNavigate={handleNavigate} 
            onOpenAuth={() => handleOpenAuth('signin')} 
          />
        )}

        {currentTab === 'verify' && currentParam && (
          <MemberProfilePage memberId={currentParam} onNavigate={handleNavigate} />
        )}

        {currentTab === 'id-check' && currentParam && (
          <IdCheckPage token={currentParam} onNavigate={handleNavigate} />
        )}
        {currentTab === 'verify' && !currentParam && (
          <VerifyPage memberNumber={currentParam} onNavigate={handleNavigate} />
        )}

        {currentTab === 'structure' && <StructurePage onNavigate={handleNavigate} />}

        {currentTab === 'activities' && <ActivitiesPage onNavigate={handleNavigate} />}

        {(currentTab === 'appreciation' || currentTab === 'appreciation-letter') && <AppreciationPage param={currentParam} />}
        {(currentTab === 'meetings' || currentTab === 'meeting') && <MeetingsPage param={currentParam} onNavigate={handleNavigate} onOpenAuth={() => handleOpenAuth('signin')} />}

        {currentTab === 'activity' && <ActivityDetailPage id={(currentParam || '').split('?')[0]} onNavigate={handleNavigate} onOpenAuth={() => handleOpenAuth('signin')} />}

        {currentTab === 'notifications' && (
          <NotificationsPage onNavigate={handleNavigate} onOpenAuth={() => handleOpenAuth('signin')} />
        )}

        {currentTab === 'legal' && (
          <LegalPage onNavigate={handleNavigate} />
        )}
      </main>

      {/* 4. Comprehensive Footer */}
      <Footer onNavigate={handleNavigate} />

      {/* 5. Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authModalMode}
        onNavigateToApply={() => handleNavigate('apply')}
      />
    </div>
  );
};

export default function App() {
  return (
    <ViewModeProvider>
      <AuthProvider>
        <DataProvider>
          <NotificationsProvider>
            <AppContent />
          </NotificationsProvider>
        </DataProvider>
      </AuthProvider>
    </ViewModeProvider>
  );
}
