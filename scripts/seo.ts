/**
 * Runs after `vite build`. Writes, into dist/:
 *  - sitemap.xml   every public page, council and published article
 *  - robots.txt    pointing search engines at the sitemap
 *  - one HTML file per public page (about.html, news/some-article.html …)
 *    with its own title, description and canonical address, so search
 *    engines see the right details even before the app loads.
 *
 * The website address comes from SITE_URL, or defaults to the address below.
 * Published articles and councils are read from Firestore's public REST API;
 * if that fails the build still succeeds with the fixed pages.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INITIAL_CHAPTERS } from '../src/data/initialData';


const SITE_URL = (process.env.SITE_URL || 'https://mashkhall.com').replace(/\/+$/, '');
// Works on every Node version used by build servers (import.meta.dirname needs Node 20.11+).
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const ORG = 'Mashkhally Zhyanawa Organisation';

interface Page { path: string; title: string; description: string; changefreq: string; priority: number; lastmod?: string }

const STATIC: Page[] = [
  { path: '/', title: ORG, description: 'Mashkhally Zhyanawa (مەشخەڵی ژیانەوە): a roadmap for restoring trust and self-confidence to our society, through self-education and self-organisation.', changefreq: 'daily', priority: 1 },
  { path: '/rebin-shamamki', title: 'Rebin Shamamki (1965–2026)', description: 'In memory of Rebin Shamamki: veteran Peshmerga, lawyer for the wronged, and committed writer. His life, with sources.', changefreq: 'monthly', priority: 0.6 },
  { path: '/about', title: 'About us', description: 'What Mashkhally Zhyanawa is: a roadmap for restoring trust and self-confidence to our society, through self-education and self-organisation in a new political movement.', changefreq: 'monthly', priority: 0.8 },
  { path: '/activities', title: 'Our activities', description: 'Demonstrations, workshops, commemorations, online meetings and community work by Mashkhally Zhyanawa members and councils.', changefreq: 'daily', priority: 0.9 },
  { path: '/appreciation', title: 'Appreciation', description: 'Members of Mashkhally Zhyanawa Organisation recognised for taking part in its official activities, with verifiable Letters of Appreciation.', changefreq: 'weekly', priority: 0.7 },
  { path: '/news', title: 'News and reports', description: 'Statements, monitoring reports, research and articles from Mashkhally Zhyanawa Organisation.', changefreq: 'daily', priority: 0.9 },
  { path: '/videos', title: 'Videos', description: 'Talks, interviews, reports and footage on human rights and Kurdish affairs from Mashkhally Zhyanawa members and contributors.', changefreq: 'weekly', priority: 0.8 },
  { path: '/structure', title: 'Our structure', description: 'How Mashkhally Zhyanawa is organised: the Board of Directors, its provinces and countries with their teams, and the Production Team.', changefreq: 'monthly', priority: 0.6 },
  { path: '/people', title: 'Members and people', description: 'Mashkhally Zhyanawa members in the five provinces of Kurdistan — Sulaymaniyah, Erbil, Duhok, Halabja and Kirkuk — and in Britain, Australia, Canada, Germany and the USA.', changefreq: 'weekly', priority: 0.7 },
  { path: '/join', title: 'Become a member', description: 'Join Mashkhally Zhyanawa Organisation. Membership is open to everyone who shares our commitment to non-violence and human rights.', changefreq: 'monthly', priority: 0.8 },
  { path: '/contribute', title: 'Publish with us', description: 'Send articles, reports, videos and statements on human rights, democracy and Kurdish affairs to Mashkhally Zhyanawa for editorial review.', changefreq: 'monthly', priority: 0.6 },
  { path: '/donate', title: 'Support our work', description: 'Donate to Mashkhally Zhyanawa. We are funded by our members and supporters, not by governments or political parties.', changefreq: 'monthly', priority: 0.6 },
  { path: '/resources', title: 'Resources', description: 'Guides and resources on human rights from Mashkhally Zhyanawa Organisation.', changefreq: 'monthly', priority: 0.5 },
  { path: '/faqs', title: 'Questions', description: 'Answers to common questions about Mashkhally Zhyanawa, membership and our work.', changefreq: 'monthly', priority: 0.4 },
  { path: '/contact', title: 'Contact us', description: 'Get in touch with Mashkhally Zhyanawa Organisation.', changefreq: 'yearly', priority: 0.5 },
  { path: '/verify', title: 'Verify a membership', description: 'Check that a Mashkhally Zhyanawa membership card is valid.', changefreq: 'yearly', priority: 0.3 },
  { path: '/legal', title: 'Privacy and terms', description: 'How Mashkhally Zhyanawa looks after your information, and the terms of using this website.', changefreq: 'yearly', priority: 0.2 },
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

const firebaseConfig = JSON.parse(await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'firebase-applet-config.json'), 'utf8')) as { projectId: string; apiKey: string };
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

type FsValue = { stringValue?: string; booleanValue?: boolean; timestampValue?: string };
type FsDoc = { name: string; fields?: Record<string, FsValue> };
const str = (d: FsDoc, k: string) => d.fields?.[k]?.stringValue || '';

const runQuery = async (body: unknown): Promise<FsDoc[]> => {
  const res = await fetch(`${FIRESTORE}:runQuery?key=${firebaseConfig.apiKey}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const rows = (await res.json()) as { document?: FsDoc }[];
  return rows.map((r) => r.document).filter((d): d is FsDoc => Boolean(d));
};

const loadArticles = async (): Promise<Page[]> => {
  try {
    const docs = await runQuery({
      structuredQuery: {
        from: [{ collectionId: 'articles' }],
        where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'published' } } },
        limit: 2000,
      },
    });
    return docs.map((d) => {
      const id = d.name.split('/').pop()!;
      const slug = str(d, 'slug') || id;
      return {
        path: `/news/${encodeURIComponent(slug)}`,
        title: str(d, 'title') || 'Article',
        description: clip(str(d, 'excerpt') || str(d, 'content').replace(/[#>*_-]/g, ' ').replace(/\s+/g, ' ').trim() || 'From Mashkhally Zhyanawa Organisation.'),
        changefreq: 'monthly',
        priority: 0.7,
        lastmod: (str(d, 'updatedAt') || str(d, 'publishedAt')).slice(0, 10) || undefined,
      };
    });
  } catch (e) {
    console.warn(`[seo] Published articles not added to the sitemap: ${(e as Error).message.slice(0, 200)}`);
    return [];
  }
};

const loadCouncils = async (): Promise<Page[]> => {
  let councils: { slug: string; name: string; description: string; archived: boolean }[] = INITIAL_CHAPTERS.map((c) => ({
    slug: c.slug || c.id, name: c.name, description: c.description || '', archived: Boolean(c.isArchived),
  }));
  try {
    const docs = await runQuery({ structuredQuery: { from: [{ collectionId: 'chapters' }], limit: 500 } });
    if (docs.length) {
      councils = docs.map((d) => ({
        slug: str(d, 'slug') || d.name.split('/').pop()!,
        name: str(d, 'name'),
        description: str(d, 'description'),
        archived: d.fields?.isArchived?.booleanValue === true,
      }));
    }
  } catch (e) {
    console.warn(`[seo] Using the built-in list of councils: ${(e as Error).message.slice(0, 200)}`);
  }
  return councils.filter((c) => !c.archived && c.name).map((c) => ({
    path: `/councils/${encodeURIComponent(c.slug)}`,
    title: `Members in ${c.name}`,
    description: clip(c.description || `Members of Mashkhally Zhyanawa Organisation in ${c.name}.`),
    changefreq: 'monthly',
    priority: 0.6,
  }));
};

const pageHtml = (template: string, page: Page) => {
  const title = page.path === '/' ? ORG : `${page.title} | Mashkhally Zhyanawa`;
  const url = `${SITE_URL}${page.path}`;
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(page.description)}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(page.description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${esc(url)}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${esc(url)}" />`);
};

const main = async () => {
  const template = await readFile(path.join(DIST, 'index.html'), 'utf8');
  const [articles, councils] = await Promise.all([loadArticles(), loadCouncils()]);
  const pages = [...STATIC, ...councils, ...articles];
  const today = new Date().toISOString().slice(0, 10);

  for (const page of pages) {
    const html = pageHtml(template, page);
    if (page.path === '/') {
      await writeFile(path.join(DIST, 'index.html'), html);
      continue;
    }
    // about.html is served at /about without a trailing slash.
    const file = path.join(DIST, `${decodeURIComponent(page.path).replace(/^\//, '')}.html`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, html);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url>
    <loc>${esc(`${SITE_URL}${p.path}`)}</loc>
    <lastmod>${p.lastmod || today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority.toFixed(1)}</priority>
  </url>`).join('\n')}
</urlset>
`;
  await writeFile(path.join(DIST, 'sitemap.xml'), sitemap);

  const robots = `User-agent: *
Allow: /
Disallow: /account
Disallow: /admin
Disallow: /notifications
Disallow: /contribute/status/

Sitemap: ${SITE_URL}/sitemap.xml
`;
  await writeFile(path.join(DIST, 'robots.txt'), robots);

  console.log(`[seo] ${pages.length} pages in sitemap.xml (${councils.length} councils, ${articles.length} articles) for ${SITE_URL}`);
};

main().catch((e) => {
  console.error('[seo] failed:', e);
  process.exit(1);
});
