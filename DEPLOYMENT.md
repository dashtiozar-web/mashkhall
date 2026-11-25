# Mashkhally Zhyanawa Organisation — Deployment & Operations Guide

This guide documents the architecture, administrative onboarding, security policies, and production deployment procedures for the **Mashkhally Zhyanawa Organisation** platform.

---

## 0. Mashkhally Zhyanawa's own Firebase project (read first)

This website uses its **own** Firebase project and database, never 17 Shubat's:

- Project: `mashkhall-8206b`
- Database: `(default)`
  (both in `firebase-applet-config.json`; the website, the worker, the backups
  and the rules deployment all read them from there)

One-time set-up, in the Firebase console for that project:

1. **Authentication → Sign-in method**: enable **Email/Password** and
   **Google** (choose a support email). Enable **Anonymous** too ("Publish
   with Us" uses it).
2. **Authentication → Settings → Authorized domains**: add `mashkhall.com`,
   `www.mashkhall.com` and the Cloudflare address
   `mashkhall.<your-subdomain>.workers.dev`.
3. **Project settings → Service accounts → Generate new private key**. Put
   the whole JSON file in:
   - Cloudflare → Workers & Pages → **mashkhall** → Settings → Variables and
     Secrets → secret `FIREBASE_SERVICE_ACCOUNT` (membership approvals,
     cards, meetings, letters);
   - GitHub → this repository → Settings → Secrets and variables → Actions →
     secret `FIREBASE_SERVICE_ACCOUNT` (publishes the database
     rules after every change). Remove any old `FIREBASE_SERVICE_ACCOUNT`
     secret copied from 17 Shubat.

The owner account is `dashtiozar@gmail.com`: signing in with it makes it the
website owner and administrator automatically.

---

## 1. System Architecture & Tech Stack

- **Frontend Runtime**: React 19 SPA, TypeScript, Vite.
- **Styling**: Tailwind CSS v4, custom deep navy (`#0B132B`) and crimson accents (`#DC2626`).
- **Icons**: Lucide React.
- **Authentication**: Firebase Authentication (Email/Password with email verification + Google Sign-In with popup).
- **Database**: Cloud Firestore Enterprise with zero-trust Attribute-Based Access Control (ABAC).
- **Rule Hardening**: Deployed via `firestore.rules` adhering to the 8 pillars of hardened rules.

---

## 2. Bootstrapped Owner & Administrative Setup

### Initial Owner Recognition
The system automatically bootstraps the designated owner:
- **Designated Owner Email**: `dashtiozar@gmail.com`
- When this user signs in (via Email/Password or Google Sign-In), the application automatically initializes:
  1. An administrative record in `/admins/{uid}` with `role: "owner"`.
  2. Full permissions in `/users/{uid}`: `['owner', 'administrator', 'member', 'publisher', 'content_reviewer', 'membership_reviewer']`.
  3. Security rules explicitly recognize `request.auth.token.email == 'dashtiozar@gmail.com'` as the root authority.

### Appointing Additional Administrators
1. Only the Owner can grant the `administrator` role.
2. From the **Admin Dashboard &rarr; Member Registry**, select an approved member and delegate the `administrator` role.
3. The server writes to `/admins/{memberUid}`, synchronously conferring administrative authority.
4. Ordinary members cannot promote themselves or remove the last owner.

---

## 3. Firebase Console Configuration (Manual Steps)

When moving from development to a production environment:

1. **Authentication Providers**:
   - Go to **Firebase Console &rarr; Build &rarr; Authentication &rarr; Sign-in method**.
   - Ensure **Email/Password** is set to **Enabled**.
   - Ensure **Google** is set to **Enabled** (OAuth client ID configured).
   - Ensure **Anonymous** is set to **Enabled**. "Publish with Us" uses a
     temporary anonymous sign-in so the database rules can limit how often a
     browser sends work. It is not an account and grants no membership.
   - **Fixes `auth/unauthorized-domain`**: open **Authentication → Settings →
     Authorized domains** and add every address the website is opened on:
     `mashkhall.com`, `www.mashkhall.com`, and the Cloudflare Workers
     address (`mashkhall.<your-subdomain>.workers.dev`). Google sign-in fails
     with this error on any address that is not on the list.
   - Signing in with Google never makes anyone a member: membership is granted
     only when the committee approves an application.

2. **Security Rules** (important: the website depends on the current rules;
   if they are not deployed, actions such as approving members fail):
   - Rules are maintained in `/firestore.rules`.
   - Deploy anytime using Firebase CLI:
     ```bash
     firebase deploy --only firestore:rules
     ```

3. **Composite Indexes**:
   - Indexes are defined in `/firestore.indexes.json`.
   - Deploy anytime using Firebase CLI:
     ```bash
     firebase deploy --only firestore:indexes
     ```

---

## 4. Initial Seed Data & Firestore Bootstrapping

The application comes pre-loaded with verified historical milestones, default UK city chapters, and published research articles in fallback memory.

To persist these default records permanently to your live Firestore database:
1. Sign in with the owner account (`dashtiozar@gmail.com`).
2. Navigate to **Administration Dashboard &rarr; Overview**.
3. Click the button labeled **"Seed Verified Records"**.
4. This writes:
   - `/chapters/london`, `/chapters/birmingham`, `/chapters/manchester`, `/chapters/newcastle`, `/chapters/glasgow`, `/chapters/cardiff`.
   - Initial verified timeline events (`hist-1` to `hist-5`) to `/site_settings/default`.
   - Initial published articles (`art-1` to `art-4`) to `/articles`.
   - Universal FAQs to `/site_settings/default`.

---

## 5. Fiduciary Workflow: Bank Details Configuration

To safeguard donor trust:
1. **Unconfigured State**:
   - Before bank details are entered or if the hide toggle is checked, the public `/donate` page displays:
     > *"Donation details will be available here soon."*
     > Followed by a direct button to contact the secretariat.
   - No mock account numbers or fake card forms are shown.
2. **Drafting Details**:
   - Authorized admins input the verified Account Holder Name, Bank Name, Account Number (with leading zeros preserved), Sort Code, IBAN, SWIFT/BIC, and Reference Instructions in **Admin Dashboard &rarr; Donation Settings**.
   - Clicking **"Save Private Draft"** saves to `/donation_config/draft`. The public website remains unaffected.
3. **Publication with Re-authentication Confirmation**:
   - Clicking **"Publish Bank Details to Public Website"** opens a verification modal requiring explicit text confirmation (`CONFIRM`).
   - Upon confirmation, details are written to `/donation_config/published`, and an immutable entry is added to `/audit_logs`.
   - The public `/donate` page immediately reveals the copyable transfer panel.

---

## 6. Directory Consent & GDPR Privacy Compliance

1. **Explicit Consent Gate**:
   - Applicants choose whether to check the **"Separate Optional Directory Consent"** box.
   - If checked, upon administrative approval, a record is created in `/public_profiles/{uid}` containing only public display name, chapter, bio, and expertise.
   - If unchecked, the member receives a Member ID and dashboard access, but no public card is created.
2. **Instant Consent Withdrawal**:
   - Any member can click **"Public Directory: Enabled (Click to Hide)"** in their Member Portal.
   - This immediately deletes the `/public_profiles/{uid}` document. The member vanishes from the public directory instantly without waiting for admin review.
3. **Data Subject Erasure**:
   - Members can request full account and data erasure through the Secretariat enquiry form with the subject *"Data Subject Request"*.

---

## 7. Build & Production Deployment

To compile and produce the static distribution build:

```bash
npm run build
```

This generates optimized client bundles in the `/dist` directory, fully compatible with Firebase Hosting, Cloudflare Pages, or Google Cloud Run.


---

## Deploying database rules automatically

The CI workflow can deploy `firestore.rules` and `firestore.indexes.json`
every time `main` changes, after the rule tests pass. To turn it on:

1. Firebase Console > Project settings > Service accounts > Generate new private key.
2. GitHub repository > Settings > Secrets and variables > Actions > New repository secret.
3. Name: `FIREBASE_SERVICE_ACCOUNT`. Value: the whole contents of the downloaded JSON file.

Until the secret exists, the deploy step is skipped and rules must be deployed by hand.

## Notifications

People with the **Broadcast notifications** permission (owners and administrators
by default; grant it to others under Administration > Users and roles) can write,
schedule, publish and withdraw notifications at `#/notifications`. Published
notifications appear in the bell in the header and as a banner the first time each
visitor sees them. They are stored in the `notifications` collection.

## Online meetings and Appreciation

Members meet in eight private rooms (six councils, the Board of Directors,
and council leaders with the Board) at `/meetings`. Audio and video use
Cloudflare Realtime (SFU), whose free allowance is 1,000 GB a month; above
that Cloudflare charges $0.05 per GB. Everything else (who may enter, the
waiting room, chat, attendance, points, letters) runs on the website's own
server (`worker/meetings.js`, `worker/meetingRoom.js`, `worker/appreciation.js`).

### One-time set-up (Cloudflare dashboard › Workers › mashkhall › Settings › Variables and secrets, type "Secret")

| Secret | Where it comes from |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase console › Project settings › Service accounts › Generate new private key. Paste the whole JSON file. Lets the server record attendance, points and letters. |
| `SFU_APP_ID`, `SFU_APP_TOKEN` | Cloudflare dashboard › Realtime › SFU › Create application. Required for video. |
| `TURN_KEY_ID`, `TURN_KEY_API_TOKEN` | Cloudflare dashboard › Realtime › TURN Server › Create. Recommended: helps members on strict networks. |

Administration › Online meetings shows which steps are done. Publish
`firestore.rules` (VERSION 2026-10-25c) in the Firebase console as well.

### How it works

- Access is decided by the server from each person's verified sign-in and
  official member record: council members enter their own council's room;
  Board members the Board and joint rooms; Council Leaders the joint room;
  the President, Deputy President, Head of Media and administrators every
  room. Copied links do not help anyone else.
- Each room's leader is chosen in Administration › Online meetings (by
  default the council's Head of Online Meeting Management). Their
  permissions can be limited or suspended.
- Reminders are sent every five minutes by the worker's scheduled run
  ("triggers" in `wrangler.jsonc`) into members' website notifications.
- Attendance is measured from the time each person was connected and
  admitted. The leader confirms the lists; points follow automatically
  (30 per meeting, +10 for three in a row, −15 once for two missed in a
  row; excused absences do not count). Corrections keep an audit record.
- Meetings are never recorded; chat and shared files are deleted when a
  meeting ends.
- After attendance is confirmed, an activity post (title, purpose, date,
  group, collage of confirmed attendees' public photos) waits for an
  administrator before appearing under Our activities.
- Activity participation is recorded by council leaders and approved by an
  administrator; approved participants receive a numbered Letter of
  Appreciation (PDF) that anyone can verify at `/appreciation/<id>`.
