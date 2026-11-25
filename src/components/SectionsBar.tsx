import React from 'react';
import { Container } from './ui';
import { SECTIONS } from '../lib/sections';

/**
 * The sections, always in view under the main menu, like a newspaper:
 * News (Kurdistan, Middle East, World) and the topics. Scrolls sideways on
 * small screens.
 */
export const SectionsBar: React.FC<{ currentTab: string; currentParam?: string; onNavigate: (tab: string, param?: string) => void }> = ({ currentTab, currentParam, onNavigate }) => {
  const active = (id: string) => currentTab === 'section' && currentParam === id;
  const link = (s: (typeof SECTIONS)[number]) => (
    <li key={s.id}>
      <a href={`/sections/${s.id}`} onClick={(e) => { e.preventDefault(); onNavigate('section', s.id); }}
        aria-current={active(s.id) ? 'page' : undefined}
        className={`block rounded-md px-2.5 py-1.5 text-[0.875rem] font-semibold whitespace-nowrap no-underline transition-colors ${
          active(s.id) ? 'bg-[#F2C14E] text-[#2A110A]' : 'text-white/85 hover:bg-white/10 hover:text-white'}`}>
        {s.name}
      </a>
    </li>
  );
  return (
    <nav aria-label="Sections" className="border-t border-white/10 bg-[#2A140C]">
      <Container>
        <div className="-mx-2 flex items-center gap-1 overflow-x-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <a href="/sections" onClick={(e) => { e.preventDefault(); onNavigate('sections'); }}
            className={`shrink-0 px-2 text-[0.75rem] font-bold tracking-[0.1em] uppercase no-underline ${currentTab === 'sections' ? 'text-[#F2C14E]' : 'text-[#F2C14E]/80 hover:text-[#F2C14E]'}`}>News</a>
          <ul className="flex shrink-0 items-center">{SECTIONS.filter((s) => s.group === 'news').map(link)}</ul>
          <span className="mx-1.5 h-5 w-px shrink-0 bg-white/20" aria-hidden="true" />
          <ul className="flex shrink-0 items-center">{SECTIONS.filter((s) => s.group === 'topic').map(link)}</ul>
        </div>
      </Container>
    </nav>
  );
};
