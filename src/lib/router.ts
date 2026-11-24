/**
 * Page addresses are ordinary paths (/about, /news/some-article) so search
 * engines can index each page. Older "#/about" links, including the QR codes
 * printed on membership cards, still work: they are turned into paths.
 */

export const ROUTE_EVENT = '17shubat:route';

/** "#/news/x" or "news/x" → "/news/x"; external links are returned unchanged. */
export const toPath = (link: string) => {
  if (!link) return '/';
  if (/^(https?:|mailto:|tel:)/i.test(link)) return link;
  if (link.startsWith('#/')) return link.slice(1);
  if (link === '#') return '/';
  if (link.startsWith('/')) return link;
  return `/${link}`;
};

/** The current address as "/path?query", after moving any "#/…" address into the path. */
export const currentPath = () => {
  const { hash, pathname, search } = window.location;
  if (hash.startsWith('#/')) {
    const next = hash.slice(1);
    window.history.replaceState(window.history.state, '', next);
    return next;
  }
  return pathname + search;
};

export const navigateTo = (url: string, replace = false) => {
  const path = toPath(url);
  if (/^(https?:|mailto:|tel:)/i.test(path)) {
    window.location.href = path;
    return;
  }
  if (path !== window.location.pathname + window.location.search) {
    if (replace) window.history.replaceState(null, '', path);
    else window.history.pushState(null, '', path);
  }
  window.dispatchEvent(new Event(ROUTE_EVENT));
};
