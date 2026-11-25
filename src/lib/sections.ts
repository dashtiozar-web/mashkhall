/**
 * The website's sections. Every article belongs to one section through its
 * category; older categories are counted in the section they belong to.
 */
export interface Section {
  id: string;
  /** Category saved on new articles in this section. */
  category: string;
  name: string;
  ku: string;
  group: 'news' | 'topic';
  /** Older categories shown in this section too. */
  also?: string[];
  description: string;
}

export const SECTIONS: Section[] = [
  { id: 'kurdistan', category: 'news_kurdistan', name: 'Kurdistan', ku: 'کوردستان', group: 'news', description: 'News from Kurdistan.' },
  { id: 'middle-east', category: 'news_middle_east', name: 'Middle East', ku: 'ڕۆژهەڵاتی ناوەڕاست', group: 'news', description: 'News from the Middle East.' },
  { id: 'world', category: 'news_world', name: 'World', ku: 'جیهان', group: 'news', description: 'News from around the world.' },
  { id: 'politics', category: 'political', name: 'Politics', ku: 'سیاسەت', group: 'topic', also: ['militia', 'legal', 'human_rights', 'human-rights'], description: 'Politics, governance, law and rights.' },
  { id: 'economy', category: 'economic', name: 'Economy', ku: 'ئابووری', group: 'topic', also: ['class_inequality'], description: 'The economy, work and livelihoods.' },
  { id: 'agriculture', category: 'agriculture', name: 'Agriculture', ku: 'کشتوکاڵ', group: 'topic', description: 'Farming, food and the countryside.' },
  { id: 'environment', category: 'environment', name: 'Environment', ku: 'ژینگە', group: 'topic', also: ['environmental'], description: 'Nature, water, climate and pollution.' },
  { id: 'health', category: 'health', name: 'Health', ku: 'تەندروستی', group: 'topic', also: ['healthcare'], description: 'Health and health care.' },
  { id: 'culture', category: 'culture', name: 'Culture', ku: 'کولتوور', group: 'topic', also: ['social', 'community', 'academic', 'research'], description: 'Culture, society, literature and the arts.' },
  { id: 'opinion', category: 'opinion', name: 'Opinion', ku: 'ڕا و بۆچوون', group: 'topic', description: 'Opinion and analysis.' },
];

export const sectionById = (id?: string) => SECTIONS.find((s) => s.id === id);

/** The section an article's category belongs to. */
export const sectionOfCategory = (category?: string) =>
  SECTIONS.find((s) => s.category === category || (s.also || []).includes(category || ''));

/** Choices for writers: the sections, with news sections named as news. */
export const SECTION_CHOICES = SECTIONS.map((s) => ({ value: s.category, label: s.group === 'news' ? `News: ${s.name}` : s.name }));
