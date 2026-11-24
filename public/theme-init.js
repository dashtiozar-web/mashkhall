// Runs before the page is shown (loaded in <head>): theme, language and reading direction.
// Kept in its own file so the Content Security Policy can forbid inline scripts.
// Apply the saved or system theme before first paint to avoid a flash.
(function () {
  try {
    var saved = localStorage.getItem('theme');
    var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
  // Set the interface language and reading direction before first paint.
  try {
    var q = new URLSearchParams(location.search).get('lang');
    var l = q || localStorage.getItem('17shubat_lang');
    if (!l) {
      var b = (navigator.languages || [navigator.language]).map(function (x) { return (x || '').toLowerCase(); });
      for (var i = 0; i < b.length && !l; i++) {
        if (b[i].indexOf('ckb') === 0 || b[i] === 'ku' || b[i] === 'ku-iq' || b[i].indexOf('ku-arab') === 0) l = 'ckb';
        else if (b[i].indexOf('ar') === 0) l = 'ar';
        else if (b[i].indexOf('en') === 0) l = 'en';
      }
    }
    if (l === 'ckb' || l === 'ar') {
      document.documentElement.lang = l;
      document.documentElement.dir = 'rtl';
    }
  } catch (e) {}
})();
