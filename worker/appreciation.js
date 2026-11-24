/**
 * Activity participation and Appreciation awards (server side).
 *
 *   1. After an official activity, the responsible council leader (or an
 *      administrator or senior official) marks who actually took part.
 *   2. They submit the list. Leaders cannot approve their own lists.
 *   3. An administrator approves, rejects or returns each person.
 *   4. Each approved participant receives an Appreciation award with a
 *      unique number and a verification page; the letter (PDF) is made
 *      from the award. Awards can be revoked, which the verification page
 *      then shows.
 *
 * Activity participation is kept separate from meeting attendance: joining
 * an online preparation meeting never counts as taking part in the activity.
 */
import { commit, getDoc, getDocs, queryDocs } from './firestore.js';
import { audit, HttpError, nameOf, now, requireAdmin, SITE, str } from './context.js';
import * as L from './meetingLogic.js';
import { councilsOf } from './councils.js';

const ENTRY = ['attended', 'not_attended', 'excused'];
const DECISION = ['approved', 'rejected', 'returned'];

const activityOf = async (env, id) => {
  if (!/^[A-Za-z0-9_-]{2,120}$/.test(String(id || ''))) throw new HttpError(400, 'Unknown activity.');
  const a = await getDoc(env, `news_banners/${id}`);
  if (!a || a.mode !== 'announcement' || a.status !== 'published') throw new HttpError(404, 'This activity was not found.');
  return a;
};

/** Councils whose members this person may mark for an activity (all = every council). */
const councilsFor = async (ctx, activity) => {
  if (ctx.isAdmin) return 'all';
  const m = ctx.member;
  if (!m || m.status !== 'active') return [];
  if (L.isSenior(m)) return 'all';
  const members = await ctx.members();
  const councils = [];
  for (const room of ctx.rooms.filter((r) => r.kind === 'council')) {
    const leader = L.leaderOf(room, ctx.roomDocs[room.id], members);
    const leads = (leader.uid === m.id && !leader.suspended && leader.permissions.activities)
      || (m.positionId === 'council_leader' && m.chapterId === room.chapterId);
    if (leads) councils.push(room.chapterId);
  }
  // A council's own activity can only be marked by that council's leader.
  if (activity?.councilId) return councils.includes(activity.councilId) ? [activity.councilId] : [];
  return councils;
};

const entryId = (activityId, uid) => `${activityId}__${uid}`;

/** For the leader: the activity, the people they may mark, and their marks so far. */
export const participationView = async (ctx, activityId) => {
  const activity = await activityOf(ctx.env, activityId);
  const councils = await councilsFor(ctx, activity);
  if (councils !== 'all' && !councils.length) throw new HttpError(403, 'Only the responsible council leader or an administrator can record participation for this activity.');
  const members = (await ctx.members()).filter((m) => m.status === 'active' && !String(m.id).startsWith('mem-'))
    .filter((m) => councils === 'all' ? (!activity.councilId || m.chapterId === activity.councilId) : councils.includes(m.chapterId));
  const entries = await queryDocs(ctx.env, 'activity_participants', { where: [['activityId', '==', activityId]] });
  const mine = entries.filter((e) => members.some((m) => m.id === e.uid));
  const registered = await queryDocs(ctx.env, `news_banners/${activityId}/registrations`).catch(() => []);
  const profiles = Object.fromEntries((await getDocs(ctx.env, members.map((m) => `public_profiles/${m.id}`))).map((p) => [p.id, p]));
  return {
    activity: { id: activity.id, title: activity.message, date: activity.eventAt || '', location: activity.location || '', councilId: activity.councilId || '' },
    councils,
    people: members.map((m) => ({
      uid: m.id, name: profiles[m.id]?.displayName || nameOf(m), photoUrl: profiles[m.id]?.photoUrl || '', chapterId: m.chapterId || '',
      registered: registered.find((r) => r.userId === m.id)?.status || (registered.some((r) => r.userId === m.id) ? 'attending' : ''),
    })).sort((a, b) => a.name.localeCompare(b.name)),
    entries: mine,
  };
};

/** The leader records (and optionally submits) who took part. */
export const saveParticipation = async (ctx, b) => {
  const view = await participationView(ctx, str(b.activityId, 120));
  const allowed = new Map(view.people.map((p) => [p.uid, p]));
  const existing = new Map(view.entries.map((e) => [e.uid, e]));
  const submit = b.submit === true;
  const at = now();
  const ops = [];
  let changed = 0;
  for (const e of Array.isArray(b.entries) ? b.entries.slice(0, 1000) : []) {
    const p = allowed.get(String(e.uid));
    if (!p || !ENTRY.includes(e.status)) continue;
    const old = existing.get(p.uid);
    // Approved entries are final; an administrator can revoke the award instead.
    if (old && old.review === 'approved') continue;
    if (old && old.review === 'rejected' && old.status === e.status && !submit) continue;
    ops.push({ set: `activity_participants/${entryId(view.activity.id, p.uid)}`, data: {
      id: entryId(view.activity.id, p.uid), activityId: view.activity.id, activityTitle: view.activity.title, activityDate: view.activity.date,
      councilId: view.activity.councilId || p.chapterId, uid: p.uid, name: p.name, chapterId: p.chapterId, status: e.status,
      note: str(e.note, 300), review: submit ? 'pending' : (old?.review === 'returned' ? 'returned' : 'draft'), reviewNote: old?.reviewNote || '',
      markedBy: ctx.who.uid, markedAt: at, ...(submit ? { submittedBy: ctx.who.uid, submittedAt: at } : {}),
      history: [...(old?.history || []), { at, by: ctx.who.uid, status: e.status, action: submit ? 'submitted' : 'saved' }].slice(-20),
    } });
    changed += 1;
  }
  for (let i = 0; i < ops.length; i += 400) await ctx.commit(ops.slice(i, i + 400));
  await audit(ctx, submit ? 'participation_submitted' : 'participation_saved', { detail: `${view.activity.title}: ${changed} people` });
  return { ok: true, changed };
};

// ---------------------------------------------------------------- administrators

const settingsOf = async (env) => (await getDoc(env, 'site_settings/appreciation')) || {};

/** Who signs: the administrator's choice, otherwise the President. */
const signatory = async (env, settings) => {
  if (settings.signatoryName) return { name: settings.signatoryName, title: settings.signatoryTitle || 'President', signatureImage: settings.signatureImage || '' };
  const president = (await queryDocs(env, 'public_profiles', { where: [['positionId', '==', 'president']], limit: 1 }))[0];
  return { name: president?.displayName || '', title: 'President', signatureImage: '' };
};

export const appreciationAdmin = async (ctx) => {
  requireAdmin(ctx);
  const [pending, returned, awards, settings] = await Promise.all([
    queryDocs(ctx.env, 'activity_participants', { where: [['review', '==', 'pending']] }),
    queryDocs(ctx.env, 'activity_participants', { where: [['review', '==', 'returned']] }),
    queryDocs(ctx.env, 'appreciation_awards', { orderBy: [['issuedAt', 'desc']], limit: 300 }),
    settingsOf(ctx.env),
  ]);
  return { pending, returned, awards, settings, signatory: await signatory(ctx.env, settings) };
};

const awardNumber = () => {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join('');
  return `17S-APP-${new Date().getUTCFullYear()}-${code}`;
};

/** An administrator decides on submitted entries; approved participants receive awards. */
export const review = async (ctx, b) => {
  requireAdmin(ctx);
  const decisions = (Array.isArray(b.decisions) ? b.decisions : []).slice(0, 500);
  const settings = await settingsOf(ctx.env);
  const sign = await signatory(ctx.env, settings);
  if (!sign.name) throw new HttpError(400, 'Set who signs the letters first (Administration › Appreciation › Letter settings), or record the President in the organisation structure.');
  const chapters = Object.fromEntries((await councilsOf(ctx.env, { includeArchived: true })).map((c) => [c.id, c.name]));
  const at = now();
  const results = { approved: 0, rejected: 0, returned: 0 };
  for (const d of decisions) {
    if (!DECISION.includes(d.decision)) continue;
    const id = str(d.id, 260);
    const e = await getDoc(ctx.env, `activity_participants/${id}`);
    if (!e || e.review !== 'pending') continue;
    // The person who submitted the list cannot approve it.
    if (e.submittedBy === ctx.who.uid && d.decision === 'approved' && !(ctx.who.emailVerified && ctx.who.email.toLowerCase() === 'dashtiozar@gmail.com')) {
      throw new HttpError(403, 'You submitted this list, so another administrator must approve it.');
    }
    const note = str(d.note, 300);
    if (d.decision !== 'approved' && note.length < 3) throw new HttpError(400, `Give a reason for ${d.decision === 'returned' ? 'returning' : 'rejecting'} ${e.name}.`);
    const ops = [{ update: `activity_participants/${id}`, data: {
      review: d.decision, reviewNote: note, reviewedBy: ctx.who.uid, reviewedAt: at,
      history: [...(e.history || []), { at, by: ctx.who.uid, action: d.decision, note }].slice(-20),
    } }];
    if (d.decision === 'approved' && e.status === 'attended') {
      const profile = await getDoc(ctx.env, `public_profiles/${e.uid}`);
      const awardId = `ap-${e.activityId}-${e.uid}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 140);
      const statement = str(settings.statement, 600) || 'In recognition of your active participation and your contribution to the work of Mashkhally Zhyanawa Organisation.';
      ops.push({ create: `appreciation_awards/${awardId}`, data: {
        id: awardId, number: awardNumber(), uid: e.uid, name: profile?.displayName || e.name,
        // The photograph is shown only if the member has a public profile photo.
        photoUrl: profile && profile.membershipStatus !== 'suspended' ? profile.photoUrl || '' : '',
        activityId: e.activityId, activityTitle: e.activityTitle, activityDate: e.activityDate || '', councilId: e.councilId || '', councilName: chapters[e.councilId] || '',
        statement, issuedAt: at, signatoryName: sign.name, signatoryTitle: sign.title, signatureImage: sign.signatureImage || '',
        verifyUrl: `${SITE}/appreciation/${awardId}`, status: 'published', submittedBy: e.submittedBy || '', approvedBy: ctx.who.uid,
      } });
      ops[0].data.awardId = awardId;
      const ok = await ctx.commit(ops);
      if (ok) {
        await ctx.commit([{ set: `user_notifications/apr-${awardId}`, data: {
          id: `apr-${awardId}`, userId: e.uid, type: 'membership', read: false, createdAt: at, link: `/appreciation/${awardId}`,
          title: 'You have received an Appreciation Letter', body: `For taking part in ${e.activityTitle}. You can download your letter from your account.`,
        } }]).catch(() => null);
      }
    } else {
      await ctx.commit(ops);
    }
    results[d.decision] += 1;
  }
  await audit(ctx, 'appreciation_reviewed', { detail: `${results.approved} approved, ${results.rejected} rejected, ${results.returned} returned` });
  return { ok: true, ...results };
};

export const revoke = async (ctx, b) => {
  requireAdmin(ctx);
  const id = str(b.id, 160);
  const reason = str(b.reason, 300);
  if (reason.length < 3) throw new HttpError(400, 'Give the reason for revoking this award.');
  const a = await getDoc(ctx.env, `appreciation_awards/${id}`);
  if (!a || a.status !== 'published') throw new HttpError(404, 'This award is not active.');
  await ctx.commit([{ update: `appreciation_awards/${id}`, data: { status: 'revoked', revokedReason: reason, revokedAt: now(), revokedBy: ctx.who.uid } }]);
  await audit(ctx, 'appreciation_revoked', { detail: `${a.number} (${a.name}): ${reason}` });
  return { ok: true };
};

/** Activities for which this person can record participation. */
export const myActivities = async (ctx) => {
  const all = (await queryDocs(ctx.env, 'news_banners', { where: [['status', '==', 'published']] }))
    .filter((a) => a.mode === 'announcement' && a.eventAt && Date.parse(a.eventAt) < Date.now() + 86400000)
    .sort((a, b) => b.eventAt.localeCompare(a.eventAt)).slice(0, 40);
  const out = [];
  for (const a of all) {
    const councils = await councilsFor(ctx, a);
    if (councils === 'all' || councils.length) out.push({ id: a.id, title: a.message, date: a.eventAt, councilId: a.councilId || '' });
  }
  return { activities: out };
};

export const withCommit = (ctx, env) => Object.assign(ctx, { commit: (ops) => commit(env, ops) });

/** The organisation logo, served from this site so letters can include it. */
export const logo = async (request, env) => {
  const r = await env.ASSETS.fetch(new Request(new URL('/logo-512.png', request.url)));
  if (!r.ok) return new Response('Not found', { status: 404 });
  return new Response(r.body, { headers: { 'content-type': r.headers.get('content-type') || 'image/jpeg', 'cache-control': 'public, max-age=86400' } });
};
