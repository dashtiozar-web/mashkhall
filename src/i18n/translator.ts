import { dirOf, getLang, Lang, localeOf, subscribeLang } from './lang';
import { fetchOverrides, Entries } from './overrides';

/**
 * Shows the website's own text in Kurdish (Sorani) or Arabic.
 *
 * The interface is written in English. When another language is chosen, each
 * piece of the website's text on the page (and in labels, placeholders,
 * tooltips, dialogs and the page title) is looked up in that language's
 * dictionary (src/i18n/dict) and replaced, and the page switches to right to
 * left. Text that changes with numbers ("Show all 23 countries") is matched
 * with the numbers as {0}, {1}…
 *
 * Publications are never translated: anything inside an element marked
 * data-i18n-skip, translate="no" or dir="auto" (titles, articles, comments,
 * names and anything else people wrote) is left exactly as written.
 * Switching back to English restores the original text.
 */

type Dict = Record<string, string>;

const loaders: Record<Exclude<Lang, 'en'>, () => Promise<{ default: Dict }>> = {
  ckb: () => import('./dict/ckb.json'),
  ar: () => import('./dict/ar.json'),
};

let dict: Dict | null = null;
let dictLang: Lang = 'en';
/** The English original of each text node / attribute we have changed. */
const originals = new WeakMap<Node, string>();
const shown = new WeakMap<Node, string>();
const attrOriginals = new WeakMap<Element, Map<string, string>>();
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt', 'aria-description', 'data-label'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'svg', 'SVG', 'path', 'IFRAME']);
const NUM = /£?\d[\d,]*(?:\.\d+)?%?/g;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Look up a piece of English text: exactly, then with its numbers as {0}, {1}… */
export const lookup = (text: string): string | null => {
  if (!dict) return null;
  const key = norm(text);
  if (!key || !/[A-Za-z]/.test(key)) return null;
  const exact = dict[key];
  if (exact !== undefined) return exact;
  const nums: string[] = [];
  const templ = key.replace(NUM, (m) => `{${nums.push(m) - 1}}`);
  if (nums.length) {
    const t = dict[templ];
    if (t !== undefined) return t.replace(/\{(\d+)\}/g, (_, i) => nums[Number(i)] ?? '');
  }
  // "Page title | Mashkhally Zhyanawa"
  if (key.includes(' | ')) {
    const parts = key.split(' | ').map((p) => dict![p] ?? p);
    if (parts.some((p, i) => p !== key.split(' | ')[i])) return parts.join(' | ');
  }
  return null;
};

/** Translate a piece of interface text in code (for dialogs and messages built in scripts). */
export const t = (text: string) => (getLang() === 'en' ? text : lookup(text) ?? text);

const keepSpaces = (original: string, translated: string) => {
  const lead = /^\s*/.exec(original)![0];
  const trail = /\s*$/.exec(original)![0];
  return lead + translated + trail;
};

const skipped = (el: Element | null): boolean => {
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName)) return true;
    if (e.hasAttribute('data-i18n-skip') || e.getAttribute('translate') === 'no' || e.getAttribute('dir') === 'auto' || (e as HTMLElement).isContentEditable) return true;
  }
  return false;
};

const translateText = (node: Text) => {
  const current = node.data;
  // React (or anything else) changed the text since we last translated it: that is the new original.
  let original = originals.get(node);
  if (original === undefined || shown.get(node) !== current) {
    original = current;
    originals.set(node, original);
  }
  if (!/[A-Za-z]/.test(original)) return;
  const want = dictLang === 'en' || !dict ? original : (() => {
    if (skipped(node.parentElement)) return original;
    const tr = lookup(original);
    return tr === null ? original : keepSpaces(original, tr);
  })();
  if (want !== current) node.data = want;
  shown.set(node, want);
};

const translateAttrs = (el: Element) => {
  let saved = attrOriginals.get(el);
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const current = el.getAttribute(a) || '';
    if (!saved) { saved = new Map(); attrOriginals.set(el, saved); }
    const prev = saved.get(a);
    let original = prev === undefined ? current : prev.split('\u0000')[0];
    const lastShown = prev === undefined ? undefined : prev.split('\u0000')[1];
    if (lastShown !== undefined && lastShown !== current) original = current;
    const want = dictLang === 'en' || !dict || skipped(el) ? original : (lookup(original) ?? original);
    if (want !== current) el.setAttribute(a, want);
    saved.set(a, `${original}\u0000${want}`);
  }
  if (el instanceof HTMLInputElement && (el.type === 'submit' || el.type === 'button') && el.value) {
    const tr = dictLang !== 'en' ? lookup(el.value) : null;
    if (tr) el.value = tr;
  }
};

const walk = (root: Node) => {
  if (root.nodeType === Node.TEXT_NODE) { translateText(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (SKIP_TAGS.has(el.tagName)) return;
  translateAttrs(el);
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE && SKIP_TAGS.has((n as Element).tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text);
    else translateAttrs(n as Element);
  }
};

let titleOriginal = '';
let titleShown = '';
const translateTitle = () => {
  const cur = document.title;
  if (cur !== titleShown) titleOriginal = cur;
  const want = dictLang === 'en' || !dict ? titleOriginal : (lookup(titleOriginal) ?? titleOriginal);
  titleShown = want;
  if (cur !== want) document.title = want;
};

const applyDocument = (lang: Lang) => {
  const html = document.documentElement;
  html.lang = lang === 'en' ? 'en-GB' : lang;
  html.dir = dirOf(lang);
};

let observer: MutationObserver | null = null;
let titleObserver: MutationObserver | null = null;

const translateAll = () => {
  walk(document.body);
  translateTitle();
};

const load = async (lang: Lang) => {
  if (lang === 'en') { dict = null; dictLang = 'en'; return; }
  try {
    const d = (await loaders[lang]()).default;
    // Normalise keys once so lookups match however the source was spaced.
    const n: Dict = {};
    for (const [k, v] of Object.entries(d)) if (v) n[norm(k)] = v;
    if (getLang() !== lang) return; // changed again while loading
    dict = n;
    dictLang = lang;
    // Corrections made on the website are applied as soon as they arrive.
    fetchOverrides(lang).then((o) => { if (dictLang === lang) applyOverrides(lang, o); });
  } catch (e) {
    console.warn('Could not load the translation', e);
    dict = null;
    dictLang = 'en';
  }
};

/** Apply corrections to the current language (also used by the translation editor after saving). */
export const applyOverrides = (lang: Lang, entries: Entries) => {
  if (lang !== dictLang || !dict) return;
  let changed = false;
  for (const [k, v] of Object.entries(entries)) {
    if (typeof v === 'string' && v.trim()) { dict[norm(k)] = v; changed = true; }
  }
  if (changed && typeof document !== 'undefined' && observer) translateAll();
};

/** Dates and times shown with English settings follow the chosen language instead. */
const patchDates = () => {
  const proto = Date.prototype as unknown as Record<string, (...a: unknown[]) => string>;
  for (const m of ['toLocaleDateString', 'toLocaleString', 'toLocaleTimeString']) {
    const orig = proto[m];
    proto[m] = function (this: Date, locales?: unknown, options?: unknown) {
      const lang = getLang();
      const english = locales === undefined || locales === 'en-GB' || locales === 'en';
      return orig.call(this, lang !== 'en' && english ? localeOf(lang) : locales, options);
    };
  }
};

/** Confirmations and prompts written in English are shown in the chosen language. */
const patchDialogs = () => {
  for (const m of ['confirm', 'alert', 'prompt'] as const) {
    const orig = window[m].bind(window) as (msg?: string, def?: string) => unknown;
    (window as unknown as Record<string, unknown>)[m] = (msg?: string, def?: string) => orig(msg === undefined ? msg : t(String(msg)), def);
  }
};

export const startTranslator = async () => {
  if (typeof document === 'undefined' || observer) return;
  patchDates();
  patchDialogs();
  applyDocument(getLang());
  await load(getLang());
  translateAll();
  observer = new MutationObserver((records) => {
    if (dictLang === 'en') {
      // Still record originals so later switches start from English.
      return;
    }
    for (const r of records) {
      if (r.type === 'characterData') translateText(r.target as Text);
      else if (r.type === 'attributes') translateAttrs(r.target as Element);
      else r.addedNodes.forEach((n) => walk(n));
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  const titleEl = document.querySelector('title');
  if (titleEl) {
    titleObserver = new MutationObserver(() => { if (document.title !== titleShown) translateTitle(); });
    titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
  }
  subscribeLang(async () => {
    const lang = getLang();
    applyDocument(lang);
    await load(lang);
    translateAll();
  });
};
