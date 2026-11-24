/**
 * Video for the online meetings: Cloudflare Realtime SFU (the free
 * allowance covers 1,000 GB a month) with the open-source partytracks
 * library. Audio and video travel through Cloudflare; this server only
 * lets someone use it while they hold a valid seat in a live meeting.
 *
 * Worker secrets (Settings > Variables and secrets of the "mashkhall" Worker):
 *   SFU_APP_ID, SFU_APP_TOKEN            – Realtime > SFU app (required)
 *   TURN_KEY_ID, TURN_KEY_API_TOKEN      – Realtime > TURN key (recommended:
 *                                          helps people on strict networks)
 */
import { routePartyTracksRequest } from 'partytracks/server';
import { SetupError } from './firestore.js';

export const videoConfigured = (env) => Boolean(env.SFU_APP_ID && env.SFU_APP_TOKEN);

const requireVideo = (env) => {
  if (!videoConfigured(env)) throw new SetupError('The video service is not connected yet (missing SFU_APP_ID or SFU_APP_TOKEN).');
};

const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

const hmacKey = (env) => crypto.subtle.importKey('raw', enc.encode(`seat:${env.SFU_APP_TOKEN}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

/**
 * A seat: a personal pass for one person in one meeting, valid for a few
 * hours, signed by this server. It carries what the meeting room needs to
 * know about them; it cannot be altered or used for another meeting.
 */
export const issueSeat = async (env, seat) => {
  requireVideo(env);
  const body = b64url(enc.encode(JSON.stringify({ ...seat, exp: Date.now() + (seat.hours || 6) * 3600_000 })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(body));
  return `${body}.${b64url(sig)}`;
};

export const readSeat = async (env, token) => {
  try {
    requireVideo(env);
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), fromB64url(sig), enc.encode(body));
    if (!ok) return null;
    const seat = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (!(seat.exp > Date.now()) || !seat.mid || !seat.uid) return null;
    return seat;
  } catch {
    return null;
  }
};

export const roomStub = (env, meetingId) => env.MEETING_ROOMS.get(env.MEETING_ROOMS.idFromName(meetingId));

/**
 * /api/meetings/sfu/<seat>/... → Cloudflare Realtime, only for a person the
 * meeting room has admitted (not waiting, not removed, meeting not ended).
 */
export const handleSfu = async (request, env) => {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/api\/meetings\/sfu\/([^/]+)(\/.*)?$/);
  if (!m) return new Response('Not found', { status: 404 });
  const seat = await readSeat(env, decodeURIComponent(m[1]));
  if (!seat) return new Response('Your meeting pass has expired. Please rejoin the meeting.', { status: 401 });
  const check = await roomStub(env, seat.mid).fetch(`https://room/admitted?uid=${encodeURIComponent(seat.uid)}`);
  if (!check.ok) return new Response('You are not admitted to this meeting.', { status: 403 });
  return routePartyTracksRequest({
    appId: env.SFU_APP_ID,
    token: env.SFU_APP_TOKEN,
    prefix: `/api/meetings/sfu/${m[1]}`,
    request,
    lockSessionToInitiator: true,
    turnServerAppId: env.TURN_KEY_ID,
    turnServerAppToken: env.TURN_KEY_API_TOKEN,
    turnServerCredentialTTL: 6 * 3600,
  });
};
