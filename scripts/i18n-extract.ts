/**
 * Lists the website's own English text (from the source code) so it can be
 * translated into Kurdish (Sorani) and Arabic:
 *   npx tsx scripts/i18n-extract.ts            → writes src/i18n/strings.json
 *   npx tsx scripts/i18n-extract.ts --missing  → lists strings without a translation
 * Text inside ${…} becomes {0}, {1}… Only interface text is collected: class
 * names, codes, addresses and data keys are skipped.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'ts5';

const ROOT = 'src';
const SKIP_FILES = /(\.test\.|worldMap|geoMaps|ukRegions|i18n[\\/]|firebase\.ts|data[\\/]memorial\.ts)/;
const SKIP_ATTRS = new Set(['className', 'key', 'id', 'type', 'href', 'src', 'name', 'htmlFor', 'role', 'autoComplete', 'accept', 'rel', 'target', 'dir', 'lang', 'inputMode', 'pattern', 'method', 'action', 'viewBox', 'd', 'fill', 'stroke', 'xmlns', 'loading', 'decoding', 'referrerPolicy', 'width', 'height', 'value', 'defaultValue', 'translate', 'data-i18n-skip', 'style', 'transform', 'points', 'textAnchor', 'dominantBaseline', 'fontFamily', 'fontWeight', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'allow', 'sandbox', 'download', 'form', 'list', 'step', 'min', 'max', 'scope', 'colSpan', 'wrap', 'enterKeyHint', 'aria-hidden', 'aria-expanded', 'aria-controls', 'aria-current', 'aria-haspopup', 'aria-live', 'aria-sort', 'aria-labelledby', 'aria-describedby', 'clipPath', 'mask', 'gradientUnits', 'offset', 'stopColor']);
const SKIP_CALLS = new Set(['doc', 'collection', 'where', 'query', 'orderBy', 'getElementById', 'querySelector', 'querySelectorAll', 'addEventListener', 'removeEventListener', 'setItem', 'getItem', 'removeItem', 'fetch', 'audit', 'addAuditLog', 'cx', 'classList', 'toggle', 'contains', 'startsWith', 'endsWith', 'includes', 'replace', 'split', 'join', 'matches', 'test', 'createElement', 'setAttribute', 'getAttribute', 'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'reportSecurityEvent', 'console', 'warn', 'error', 'log', 'require', 'import', 'Error_', 'setActiveTab', 'go', 'onNavigate', 'handleNavigate', 'navigateTo', 'useState', 'hasPermission', 'hasRole', 'hasAnyRole', 'ledgerAward', 'Intl', 'DisplayNames', 'encodeURIComponent', 'new Date', 'padStart', 'slice', 'indexOf', 'localeCompare', 'dispatchEvent', 'Event', 'matchMedia', 'notifyUser']);

const looksLikeText = (s: string) => {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length < 2 || !/[A-Za-z]{2}/.test(t)) return false;
  if (/^(https?:|mailto:|tel:|data:|\/|#|\.|media:|gs_|gm_|art-|img-)/.test(t)) return false;
  if (/^[a-z0-9_.:/\-[\]()&>%#=!*@]+$/.test(t)) return false; // ids, codes, classes, paths
  if (/^[A-Z0-9_]+$/.test(t)) return false; // CONSTANTS
  if (/\b(px|py|pt|pb|ps|pe|mt|mb|ms|me|gap|text|bg|border|rounded|flex|grid|items|justify|w|h|min-w|max-w|font|leading|tracking|shadow|ring|hover|focus|sm|md|lg|xl)-/.test(t) && !/[.!?]$/.test(t) && t.split(' ').every((w) => /[-:[\]/]/.test(w) || /^[a-z]+$/.test(w))) return false;
  if (/^(application|text|image)\/[\w+.-]+/.test(t)) return false;
  if (/^[\w-]+@[\w.-]+$/.test(t)) return false;
  if (/^\d{4}-\d{2}/.test(t)) return false;
  if (/[{};]\s*$/.test(t) && /[:;]/.test(t) && !/[.?!]\s*$/.test(t)) return false; // CSS/JS code
  if (/^(SELECT|INSERT|CREATE|UPDATE|DELETE) /.test(t)) return false;
  if (/^[MLHVCSQTAZmlhvcsqtaz0-9.,\s-]+$/.test(t)) return false; // SVG paths
  if (/\.(jpe?g|png|webp|svg|gif|json|tsx?|css|html)$/i.test(t)) return false; // file names
  if (/^[a-z]+[A-Z]\w*$/.test(t)) return false; // camelCase identifiers
  if (/^[\w-]+-\{\d\}$/.test(t) || /^\{\d\}[\w/-]*$/.test(t) || /^[\w:/-]*\{\d\}[\w:/.-]*$/.test(t) && !/\s/.test(t)) return false; // generated ids
  if (/^[A-Z]{2,}[_:][\w:]+/.test(t)) return false; // AUDIT_CODES
  if (/^(Firestore|Firebase|Error):/.test(t)) return false;
  return true;
};

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

const files: string[] = [];
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|json)$/.test(f) && !SKIP_FILES.test(p) && !/\.json$/.test(f)) files.push(p);
  }
};
walk(ROOT);

const found = new Map<string, Set<string>>();
const add = (s: string, where: string) => {
  const t = norm(s);
  if (!looksLikeText(t)) return;
  if (!found.has(t)) found.set(t, new Set());
  found.get(t)!.add(where);
};

const calleeName = (n: ts.Node): string => {
  if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
    const e = n.expression;
    if (ts.isIdentifier(e)) return e.text;
    if (ts.isPropertyAccessExpression(e)) return e.name.text;
  }
  return '';
};

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const rel = file.replace(/\\/g, '/');
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      if (SKIP_ATTRS.has(name) || name.startsWith('on') && name !== 'onboarding') return;
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      if (SKIP_CALLS.has(calleeName(node))) return;
      const exprText = node.expression.getText(sf);
      if (/^(console|JSON|Object|Math|localStorage|sessionStorage|document|crypto|URL|Array|String|Number|Promise)\b/.test(exprText)) return;
    }
    if (ts.isElementAccessExpression(node)) { visit(node.expression); return; }
    if (ts.isPropertyAssignment(node)) {
      const key = node.name.getText(sf).replace(/['"]/g, '');
      if (/^(id|key|type|kind|code|status|role|path|slug|collection|category|contentType|className|cls|color|icon|tab|unit|positionId|councilId|provider|mode|action|by|tier|scope|format|value|variant|tone|placement|channel|via|dir|direction|language|lang|src|url|href|image|photo|tag|field|permission|feedDot|style|banner|sort|group|dept|department|departmentId|ref|name_key|metric)$/.test(key)) {
        // values of data keys are not interface text, unless the key holds a sentence
        const init = node.initializer;
        if ((ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) && !/\s/.test(init.text)) return;
        if (ts.isStringLiteral(init) && /^(id|key|type|kind|code|status|role|path|slug|collection|className|cls|color|tab|ref|src|url|href|style)$/.test(key)) return;
      }
      visit(node.initializer);
      return;
    }
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(node.operatorToken.kind)) return;
    if (ts.isCaseClause(node)) { node.statements.forEach(visit); return; }
    if (ts.isTypeNode(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return;
    if (ts.isJsxText(node)) add(node.text, rel);
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text, rel);
    else if (ts.isTemplateExpression(node)) {
      let s = node.head.text;
      node.templateSpans.forEach((span, i) => { s += `{${i}}` + span.literal.text; });
      add(s, rel);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const out: Record<string, string[]> = {};
[...found.keys()].sort((a, b) => a.localeCompare(b)).forEach((k) => { out[k] = [...found.get(k)!].sort(); });

if (process.argv.includes('--missing')) {
  const lang = process.argv[process.argv.indexOf('--missing') + 1] || 'ckb';
  const dictPath = `src/i18n/dict/${lang}.json`;
  const dict = existsSync(dictPath) ? JSON.parse(readFileSync(dictPath, 'utf8')) : {};
  const missing = Object.keys(out).filter((k) => !(k in dict));
  console.log(`${missing.length} of ${Object.keys(out).length} strings have no ${lang} translation.`);
  if (process.argv.includes('--list')) missing.forEach((m) => console.log(m));
} else {
  writeFileSync('src/i18n/strings.json', JSON.stringify(Object.keys(out), null, 1));
  console.log(`${Object.keys(out).length} strings written to src/i18n/strings.json`);
}
