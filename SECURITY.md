# Security, recovery and incident response

The Mashkhally Zhyanawa website publishes political and human-rights material and is
used by members in the UK, Iraq, the Kurdistan Region and Iran. This file
records how it is protected, how to recover it, and what to do in an
incident. No website can be made impossible to attack or to block; the aim
is strong protection, early warning and fast recovery.

## How the site is built

| Part | Where it runs | Notes |
| --- | --- | --- |
| Website and server code | Cloudflare Workers (`worker/`, `dist/`) | No origin server: Cloudflare serves everything, so there is no server address to discover or attack directly. |
| Database and sign-in | Google Firebase (project `gen-lang-client-0463043065`) | Protected by `firestore.rules` (tested in CI). |
| Video meetings | Cloudflare Realtime SFU | Only people the meeting room has admitted can use it. |
| Code | GitHub `dashtiozar-web/mashkhall` (private) | Every change is built and tested before it goes live. |

## Protections in place

- HTTPS everywhere, HSTS, and a strict Content-Security-Policy (`public/_headers`):
  the browser loads code only from this site and Google sign-in; no inline
  scripts; frames only from our video and Facebook embeds; the site cannot be
  framed by other sites. Blocked content is reported to `/api/csp-report` and
  counted in Administration › Security.
- Camera, microphone and screen sharing are allowed only for this site (meetings).
- Request limits per visitor on the API (600/minute, 60 writes/minute) and a
  256 KB limit on request size; refused requests are counted (sampled).
- Database rules: least privilege for every collection; roles, points,
  attendance, letters and meeting records cannot be changed from a browser.
  Meetings, attendance, points and letters are written only by the server,
  which checks the person's verified sign-in and official member record.
- Uploaded images are re-encoded in the browser and must be JPEG/PNG/WebP data
  (enforced by the rules); meeting chat files are limited by type and size and
  deleted when the meeting ends.
- Audit records: administration actions, meeting management, attendance
  corrections, points, letters.
- No secrets in the code or the browser: keys are Worker secrets or GitHub
  secrets. The Firebase browser key is public by design.
- `/.well-known/security.txt` says how to report a problem.

## Backups (`.github/workflows/backup.yml`)

Every night a full copy of the database is exported, encrypted with AES-256
(passphrase in the `BACKUP_PASSPHRASE` secret, also kept offline), stored as a
GitHub artifact for 30 days, and **restored into an empty test database to
prove it is complete**. Backups live outside Firebase and outside the website,
so a compromised website administrator account cannot delete them.

### Restoring after data loss

1. GitHub › Actions › Database backup › choose the last good run › download the artifact.
2. Decrypt: `openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -in FILE.tar.gz.enc | tar -xzf - -C restore`
   (enter the backup passphrase).
3. Check first, into a local emulator:
   `npx firebase-tools emulators:exec --only firestore "node scripts/backup/restore.mjs restore"`
4. Restore into the live project (overwrites documents with their backed-up
   version): `FIREBASE_SERVICE_ACCOUNT='…' node scripts/backup/restore.mjs restore --confirm-project=gen-lang-client-0463043065`

Code is in Git (every version recoverable). Cloudflare settings and DNS should
be exported from the Cloudflare dashboard after any change and kept offline.

## Monitoring (`.github/workflows/monitor.yml`)

Every 3 hours: home page, API, security headers, HTTP→HTTPS, that the domain's
name servers and addresses are still Cloudflare's (detects hijacking), DNSSEC,
and certificate expiry. Twice a day: tests from volunteer test points in Iraq
and Iran (Globalping) for HTTPS and DNS filtering, plus public OONI
censorship measurements. Problems open a GitHub issue labelled `monitoring`
(emailed to the owner) and close it when resolved.

## Incident response

1. **Contain.** Suspected account compromise: in Firebase › Authentication
   disable the account and revoke its sessions; remove it from `/admins` and
   its roles. Suspected key leak: rotate it (below). Defacement: revert the
   content from the audit record or restore from backup.
2. **Preserve evidence.** Export Administration › Audit log and Security,
   Cloudflare security events, Firebase Authentication logs and the GitHub
   Actions history before changing anything else.
3. **Rotate credentials.** Firebase service-account key (Google Cloud › IAM ›
   Service accounts › Keys: delete the old key, create a new one, update the
   Worker secret and the GitHub secret); SFU and TURN tokens (Cloudflare ›
   Realtime); Cloudflare and GitHub API tokens; passwords of affected admins.
4. **Restore** clean data from the last good backup (above).
5. **Notify.** If members' personal data may have been exposed, assess the
   risk to those in Iraq and Iran first and warn them directly and safely; a
   UK organisation must report notifiable personal-data breaches to the ICO
   within 72 hours.
6. **Recover and review.** Re-enable services, watch monitoring closely, and
   record what happened and what will change.

## If the site is blocked in a country

Blocking of the domain or of its DNS cannot be prevented by the website
itself. Prepare in advance:
- The Worker is also reachable at its `*.workers.dev` address (already an
  authorised sign-in domain). Share alternative addresses only through
  official channels (Telegram, Facebook), not on the site itself.
- Cloudflare › Network › Onion Routing (on) helps Tor users reach the site.
- Keep a second domain registered with a different registrar, ready to point
  to the same Worker; publish it only when needed.
- Readers can use Tor Browser, Psiphon or a trusted VPN; the site's protections
  do not block VPN users.

## Settings only the owner can change (do these)

See the security report shared with the organisation for the step-by-step list:
two-step sign-in on the Google, Cloudflare and GitHub accounts; registrar lock
and DNSSEC on the domain; Cloudflare WAF managed rules, Bot Fight Mode,
"Always use HTTPS" and minimum TLS 1.2; restricting the Firebase browser key;
Firebase App Check; and two-step sign-in for website administrators.
