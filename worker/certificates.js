/**
 * Appreciation letters and certificates issued directly by administrators
 * (the activity-participation route stays in appreciation.js).
 *
 * Workflow:
 *   1. An administrator (or membership staff) chooses an approved member,
 *      a category, the achievement and reason, the issue date and the
 *      signatory, and saves a draft. The letter is previewed in the browser.
 *   2. Staff without administrator rights submit the draft for approval.
 *   3. An administrator approves and issues it: it gets a unique number and
 *      its own unguessable verification address (separate from the member's
 *      card), the member's current verified name is fixed on it, and the
 *      member is told.
 *   4. Issued documents are never rewritten. A correction issues a
 *      replacement (the old one shows as superseded, with a link to the new
 *      one); a withdrawal revokes it. Every step is kept in its history and
 *      in the audit log.
 *
 * Routes (/api/appreciation/…):
 *   GET  dashboard              drafts, pending, issued, revoked/replaced, categories, members
 *   GET  member?id=             one member's appreciation history
 *   POST save                   create or change a draft
 *   POST submit                 send a draft for approval
 *   POST issue                  approve and issue (administrators)
 *   POST discard                delete a draft
 *   POST revoke                 revoke an issued document (administrators)
 *   POST replace                correct an issued document by issuing a replacement (administrators)
 *   POST categories             change the list of categories (administrators)
 */
import { commit, getDoc, queryDocs, SetupError } from './firestore.js';
import { HttpError, json, now, SITE, str } from './context.js';
import { POSITIONS, positionOf, staffOf } from './members.js';
import { councilsOf } from './councils.js';

export const DEFAULT_CATEGORIES = [
  { id: 'outstanding_activity', label: 'Outstanding Activity' },
  { id: 'research', label: 'Research and Investigation' },
  { id: 'media', label: 'Media Contribution' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'volunteer', label: 'Volunteer Service' },
  { id: 'production', label: 'Production' },
  { id: 'special', label: 'Special Recognition' },
];
const KINDS = ['letter', 'certificate'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const randomId = (n = 22) => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => abc[b % abc.length]).join('');
};

const numberCode = () => {
  const abc = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => abc[b % abc.length]).join('');
};

/** A certificate number not used before: 17S-APP-2026-7K3QXM. */
const newNumber = async (env, issueDate) => {
  for (let i = 0; i < 8; i++) {
    const n = `17S-APP-${issueDate.slice(0, 4)}-${numberCode()}`;
    if (!(await queryDocs(env, 'appreciation_awards', { where: [['number', '==', n]], limit: 1 })).length) return n;
  }
  throw new HttpError(503, 'Could not create a certificate number. Please try again.');
};

const settingsOf = async (env) => (await getDoc(env, 'site_settings/appreciation')) || {};
const categoriesOf = (settings) => (Array.isArray(settings.categories) && settings.categories.length ? settings.categories : DEFAULT_CATEGORIES)
  .filter((c) => c && typeof c.id === 'string' && typeof c.label === 'string');

const defaultSignatory = async (env, settings) => {
  if (settings.signatoryName) return { name: settings.signatoryName, title: settings.signatoryTitle || 'President', signatureImage: settings.signatureImage || '' };
  const president = (await queryDocs(env, 'public_profiles', { where: [['positionId', '==', 'president']], limit: 1 }))[0];
  return { name: president?.displayName || '', title: 'President', signatureImage: '' };
};

const entry = (staff, action, note = '') => ({ at: now(), by: staff.who.uid, byName: staff.name, action, ...(note ? { note } : {}) });

const auditOp = (staff, action, targetId, details) => {
  const id = `log-${Date.now()}-${randomId(5)}`;
  return { set: `audit_logs/${id}`, data: { id, actorUid: staff.who.uid, actorEmail: staff.who.email || '', actorName: staff.name, action, targetType: 'appreciation', targetId, details: details.slice(0, 4000), timestamp: now() } };
};

const loadAward = async (env, id) => {
  if (!/^[A-Za-z0-9_-]{4,160}$/.test(String(id || ''))) throw new HttpError(400, 'Unknown letter.');
  const a = await getDoc(env, `appreciation_awards/${id}`);
  if (!a) throw new HttpError(404, 'This letter no longer exists.');
  return a;
};

const memberSummary = (m, chapters) => ({
  id: m.id,
  fullName: m.fullName,
  displayName: m.displayName || m.fullName,
  memberNumber: m.memberNumber || '',
  position: POSITIONS.get(positionOf(m))?.title || 'Member',
  council: chapters.find((c) => c.id === m.chapterId)?.name || '',
  photoUrl: m.photoUrl || '',
});

// ---------------------------------------------------------------- reading

export const dashboard = async (env, staff) => {
  if (!staff.canMembers) throw new HttpError(403, 'Only administrators and membership staff can manage appreciation.');
  const [all, settings, members, chapters] = await Promise.all([
    queryDocs(env, 'appreciation_awards'),
    settingsOf(env),
    queryDocs(env, 'members', { where: [['status', '==', 'active']] }),
    councilsOf(env, { includeArchived: true }),
  ]);
  all.sort((a, b) => String(b.issuedAt || b.createdAt || '').localeCompare(String(a.issuedAt || a.createdAt || '')));
  return {
    awards: all.map(({ history, ...a }) => ({ ...a, historyCount: (history || []).length })),
    categories: categoriesOf(settings),
    signatory: await defaultSignatory(env, settings),
    statement: settings.statement || '',
    members: members.map((m) => memberSummary(m, chapters)).sort((a, b) => a.fullName.localeCompare(b.fullName)),
    isAdmin: staff.isAdmin,
  };
};

export const memberAwards = async (env, staff, memberId) => {
  if (!staff.canMembers) throw new HttpError(403, 'Only administrators and membership staff can see this.');
  const awards = await queryDocs(env, 'appreciation_awards', { where: [['uid', '==', String(memberId || '')]] });
  awards.sort((a, b) => String(b.issuedAt || b.createdAt || '').localeCompare(String(a.issuedAt || a.createdAt || '')));
  return { awards };
};

// ---------------------------------------------------------------- drafts

const draftFields = async (env, body, settings) => {
  const kind = KINDS.includes(body.kind) ? body.kind : 'certificate';
  const cats = categoriesOf(settings);
  const category = cats.find((c) => c.id === body.category);
  if (!category) throw new HttpError(400, 'Choose an appreciation category.');
  const achievement = str(body.achievement, 200);
  if (achievement.length < 3) throw new HttpError(400, 'Describe the achievement being recognised.');
  const reason = str(body.reason, 1200);
  if (reason.length < 10) throw new HttpError(400, 'Write the reason for the appreciation (at least a sentence).');
  const issueDate = DATE.test(String(body.issueDate || '')) ? body.issueDate : now().slice(0, 10);
  const sign = await defaultSignatory(env, settings);
  const signatoryName = str(body.signatoryName, 120) || sign.name;
  const signatoryTitle = str(body.signatoryTitle, 120) || sign.title;
  if (!signatoryName) throw new HttpError(400, 'Choose who signs the letter.');
  return {
    kind, category: category.id, categoryLabel: category.label, achievement, reason, issueDate, signatoryName, signatoryTitle,
    signatureImage: signatoryName === sign.name ? sign.signatureImage || '' : '',
  };
};

export const saveDraft = async (env, staff, body) => {
  if (!staff.canMembers) throw new HttpError(403, 'Only administrators and membership staff can prepare appreciation letters.');
  const settings = await settingsOf(env);
  const fields = await draftFields(env, body, settings);
  const member = await getDoc(env, `members/${String(body.memberId || '')}`);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(body.memberId || '')) || !member) throw new HttpError(400, 'Choose an approved member.');
  if (member.status !== 'active') throw new HttpError(409, 'Appreciation can only be given to members whose membership is active.');
  const chapters = await councilsOf(env, { includeArchived: true });
  const m = memberSummary({ ...member, id: member.id }, chapters);
  const t = now();
  if (body.id) {
    const a = await loadAward(env, body.id);
    if (!['draft', 'pending'].includes(a.status)) throw new HttpError(409, 'Issued letters cannot be edited. Use “Correct and reissue” instead.');
    const data = {
      ...fields, uid: m.id, name: m.fullName, memberNumber: m.memberNumber, positionTitle: m.position, councilName: m.council,
      activityTitle: fields.achievement, updatedAt: t, history: [...(a.history || []), entry(staff, 'edited')].slice(-50),
      // Editing a submitted draft sends it back to draft unless an administrator edits it.
      status: a.status === 'pending' && !staff.isAdmin ? 'draft' : a.status,
    };
    await commit(env, [{ update: `appreciation_awards/${a.id}`, data }]);
    return { award: { ...a, ...data } };
  }
  const id = randomId();
  const data = {
    id, source: 'direct', status: 'draft', number: '', ...fields,
    uid: m.id, name: m.fullName, memberNumber: m.memberNumber, positionTitle: m.position, councilName: m.council, photoUrl: '',
    activityId: '', activityTitle: fields.achievement, activityDate: '', statement: fields.reason,
    verifyUrl: `${SITE}/appreciation/${id}`,
    createdBy: staff.who.uid, createdByName: staff.name, createdAt: t, updatedAt: t,
    history: [entry(staff, 'created')],
  };
  await commit(env, [{ create: `appreciation_awards/${id}`, data }, auditOp(staff, 'APPRECIATION_DRAFTED', id, `${fields.categoryLabel} for ${m.fullName}: ${fields.achievement}`)]);
  return { award: data };
};

export const submitDraft = async (env, staff, body) => {
  if (!staff.canMembers) throw new HttpError(403, 'Not allowed.');
  const a = await loadAward(env, body.id);
  if (a.status !== 'draft') throw new HttpError(409, 'Only drafts can be submitted for approval.');
  await commit(env, [
    { update: `appreciation_awards/${a.id}`, data: { status: 'pending', submittedBy: staff.who.uid, submittedByName: staff.name, submittedAt: now(), history: [...(a.history || []), entry(staff, 'submitted')].slice(-50) } },
    auditOp(staff, 'APPRECIATION_SUBMITTED', a.id, `${a.categoryLabel} for ${a.name}`),
  ]);
  return { ok: true };
};

export const discardDraft = async (env, staff, body) => {
  if (!staff.canMembers) throw new HttpError(403, 'Not allowed.');
  const a = await loadAward(env, body.id);
  if (!['draft', 'pending'].includes(a.status)) throw new HttpError(409, 'Issued letters cannot be deleted. Revoke it instead.');
  if (!staff.isAdmin && a.createdBy !== staff.who.uid) throw new HttpError(403, 'Only the person who prepared this draft, or an administrator, can delete it.');
  await commit(env, [{ delete: `appreciation_awards/${a.id}` }, auditOp(staff, 'APPRECIATION_DRAFT_DELETED', a.id, `${a.categoryLabel} for ${a.name}`)]);
  return { ok: true };
};

// ---------------------------------------------------------------- issuing

/** The fields fixed at issue: number, the member's current verified name and details. */
const issueOps = async (env, staff, a, extra = {}) => {
  const member = await getDoc(env, `members/${a.uid}`);
  if (!member) throw new HttpError(409, 'The member record no longer exists.');
  if (member.status !== 'active') throw new HttpError(409, `${member.fullName}’s membership is not active, so the letter cannot be issued.`);
  const chapters = await councilsOf(env, { includeArchived: true });
  const m = memberSummary({ ...member, id: member.id }, chapters);
  const profile = await getDoc(env, `public_profiles/${a.uid}`);
  const number = await newNumber(env, a.issueDate || now().slice(0, 10));
  const t = now();
  const data = {
    status: 'published', number, name: m.fullName, memberNumber: m.memberNumber, positionTitle: m.position, councilName: m.council,
    photoUrl: profile && profile.membershipStatus !== 'suspended' ? profile.photoUrl || '' : '',
    issuedAt: t, approvedBy: staff.who.uid, approvedByName: staff.name, statement: a.reason || a.statement || '',
    history: [...(a.history || []), entry(staff, 'issued', number)].slice(-50), ...extra,
  };
  const nid = `apr-${a.id}`;
  return {
    data,
    notify: { set: `user_notifications/${nid}`, data: { id: nid, userId: a.uid, type: 'membership', read: false, createdAt: t, link: `/appreciation/${a.id}`, title: `You have received a ${a.kind === 'letter' ? 'Letter' : 'Certificate'} of Appreciation`, body: `${a.categoryLabel}: ${a.achievement}. You can view and download it from your account.` } },
  };
};

export const issue = async (env, staff, body) => {
  if (!staff.isAdmin) throw new HttpError(403, 'Only an administrator can approve and issue appreciation letters.');
  const a = await loadAward(env, body.id);
  if (!['draft', 'pending'].includes(a.status)) throw new HttpError(409, 'This letter has already been issued.');
  const { data, notify } = await issueOps(env, staff, a);
  await commit(env, [{ update: `appreciation_awards/${a.id}`, data }, notify, auditOp(staff, 'APPRECIATION_ISSUED', a.id, `${data.number}: ${a.categoryLabel} for ${data.name} (${a.achievement})`)]);
  return { award: { ...a, ...data } };
};

export const revokeAward = async (env, staff, body) => {
  if (!staff.isAdmin) throw new HttpError(403, 'Only an administrator can revoke appreciation letters.');
  const a = await loadAward(env, body.id);
  const reason = str(body.reason, 500);
  if (reason.length < 3) throw new HttpError(400, 'Give the reason for revoking it.');
  if (a.status !== 'published') throw new HttpError(409, 'Only a valid issued letter can be revoked.');
  await commit(env, [
    { update: `appreciation_awards/${a.id}`, data: { status: 'revoked', revokedReason: reason, revokedAt: now(), revokedBy: staff.who.uid, history: [...(a.history || []), entry(staff, 'revoked', reason)].slice(-50) } },
    auditOp(staff, 'APPRECIATION_REVOKED', a.id, `${a.number} (${a.name}): ${reason}`),
  ]);
  return { ok: true };
};

/**
 * Correct an issued letter: a replacement is issued with a new number and
 * address; the original stays on record as superseded, pointing to it.
 */
export const replaceAward = async (env, staff, body) => {
  if (!staff.isAdmin) throw new HttpError(403, 'Only an administrator can correct issued letters.');
  const a = await loadAward(env, body.id);
  if (a.status !== 'published') throw new HttpError(409, 'Only a valid issued letter can be corrected.');
  const reason = str(body.correction, 500);
  if (reason.length < 3) throw new HttpError(400, 'Say what is being corrected.');
  const settings = await settingsOf(env);
  const fields = await draftFields(env, {
    kind: body.kind ?? a.kind ?? 'letter', category: body.category ?? a.category ?? 'outstanding_activity',
    achievement: body.achievement ?? a.achievement ?? a.activityTitle, reason: body.reason ?? a.reason ?? a.statement,
    issueDate: body.issueDate ?? a.issueDate ?? (a.issuedAt || '').slice(0, 10), signatoryName: body.signatoryName ?? a.signatoryName, signatoryTitle: body.signatoryTitle ?? a.signatoryTitle,
  }, settings);
  const id = randomId();
  const base = {
    id, source: a.source || 'activity', ...fields, uid: a.uid, activityId: a.activityId || '', activityTitle: a.source === 'direct' || !a.activityId ? fields.achievement : a.activityTitle,
    activityDate: a.activityDate || '', councilId: a.councilId || '', verifyUrl: `${SITE}/appreciation/${id}`, replaces: a.id, replacesNumber: a.number,
    createdBy: staff.who.uid, createdByName: staff.name, createdAt: now(), updatedAt: now(), history: [entry(staff, 'created', `Replacement for ${a.number}: ${reason}`)],
  };
  const { data, notify } = await issueOps(env, staff, base);
  await commit(env, [
    { create: `appreciation_awards/${id}`, data: { ...base, ...data } },
    { update: `appreciation_awards/${a.id}`, data: { status: 'superseded', supersededBy: id, supersededByNumber: data.number, correction: reason, supersededAt: now(), history: [...(a.history || []), entry(staff, 'superseded', `${data.number}: ${reason}`)].slice(-50) } },
    notify,
    auditOp(staff, 'APPRECIATION_REPLACED', a.id, `${a.number} replaced by ${data.number} for ${data.name}: ${reason}`),
  ]);
  return { award: { ...base, ...data } };
};

export const saveCategories = async (env, staff, body) => {
  if (!staff.isAdmin) throw new HttpError(403, 'Only administrators can change the categories.');
  const list = (Array.isArray(body.categories) ? body.categories : []).slice(0, 40).map((c) => ({
    id: String(c.id || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || String(c.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40),
    label: str(c.label, 80),
  })).filter((c) => c.id && c.label.length >= 2);
  if (!list.length) throw new HttpError(400, 'Keep at least one category.');
  if (new Set(list.map((c) => c.id)).size !== list.length) throw new HttpError(400, 'Two categories have the same name.');
  await commit(env, [{ merge: 'site_settings/appreciation', data: { categories: list, updatedAt: now() } }, auditOp(staff, 'APPRECIATION_CATEGORIES_UPDATED', 'categories', list.map((c) => c.label).join(', '))]);
  return { categories: list };
};

// ---------------------------------------------------------------- routing

export const handleCertificates = async (request, env) => {
  const url = new URL(request.url);
  const action = url.pathname.replace(/^\/api\/appreciation\//, '');
  try {
    const staff = await staffOf(env, request);
    if (request.method === 'GET') {
      if (action === 'dashboard') return json(await dashboard(env, staff));
      if (action === 'member') return json(await memberAwards(env, staff, url.searchParams.get('id')));
      return json({ error: 'Not found' }, 404);
    }
    if (request.method !== 'POST') return json({ error: 'Not allowed' }, 405);
    let body;
    try { body = await request.json(); } catch { throw new HttpError(400, 'The request could not be read.'); }
    const routes = { save: saveDraft, submit: submitDraft, discard: discardDraft, issue, revoke: revokeAward, replace: replaceAward, categories: saveCategories };
    if (!routes[action]) return json({ error: 'Not found' }, 404);
    return json(await routes[action](env, staff, body));
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof SetupError || e?.setup) return json({ error: `The website server is not fully set up: ${e.message}`, setup: true }, 503);
    console.error('appreciation error', e);
    return json({ error: 'This could not be saved because the database did not answer. Nothing was changed. Please try again.' }, 502);
  }
};
