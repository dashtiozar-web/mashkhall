# 17 Shubat Organization — Security Specification & Threat Model

## 1. System Invariants

1. **Identity & Role Segregation (Zero-Trust ABAC)**:
   - Client claims (`request.auth.token.role`) are never trusted. Privileges are derived exclusively from verified Firestore records (`/admins/{uid}`) and the bootstrapped owner (`dashtiozar@gmail.com`).
   - Normal users are strictly forbidden from modifying the `roles`, `isAdmin`, or `status` attributes of their own documents.
   - Non-administrators cannot promote themselves to `owner`, `administrator`, `membership_reviewer`, or `publisher`.

2. **PII Isolation (Split Collection Architecture)**:
   - Private applicant data (legal full name, personal email, phone number, private introduction notes, staff notes) in `/applications/{applicationId}` and `/members/{memberId}` is accessible exclusively by the applicant and authorized reviewers/admins.
   - `/public_profiles/{profileId}` contains only sanitized public data (display name, city chapter name, approved bio, optional public photo, expertise tags).
   - A document in `/public_profiles/{profileId}` exists **only** if the member has explicitly provided directory consent (`consentToDirectory == true`) and their membership application has been approved.
   - If a member revokes directory consent, their `/public_profiles/{profileId}` record is deleted immediately.

3. **Content Publishing Lifecycle & Immutability**:
   - Member submissions start in `submitted` or `draft` status.
   - Ordinary members cannot set `status = 'published'` or approve their own submissions.
   - Published articles in `/articles/{articleId}` remain live until an authorized editor approves an updated revision. Unreviewed drafts or edits never overwrite the live public version.
   - Deleted drafts do not affect existing public articles.

4. **Fiduciary Protection (Donation & Bank Details)**:
   - Bank transfer details in `/donation_config/published` can only be modified and published by administrators and the owner.
   - Anonymous visitors or non-admin users have read-only access to `/donation_config/published` only if `isPublished == true`.
   - Draft donation records (`/donation_config/draft`) are private to administrators.
   - No financial credentials (passwords, PINs, card numbers) are ever requested or stored.

5. **Audit Trail Integrity**:
   - The `/audit_logs/{logId}` collection is append-only by authenticated callers.
   - Updates and deletes on `/audit_logs/{logId}` are permanently blocked (`allow update, delete: if false`).

---

## 2. The "Dirty Dozen" Threat Payloads

| Payload ID | Vector | Target Path | Attacker Intent | Expected Status |
| :--- | :--- | :--- | :--- | :--- |
| **PAYLOAD-01** | Privilege Escalation | `/admins/{attackerUid}` | Attacker attempts to create an admin document for themselves. | `PERMISSION_DENIED` |
| **PAYLOAD-02** | Role Injection | `/users/{attackerUid}` | Attacker sends `roles: ['owner', 'administrator']` in profile payload. | `PERMISSION_DENIED` |
| **PAYLOAD-03** | PII Scraping | `/applications/{victimAppId}` | Attacker attempts to read private applicant phone, email, and staff notes. | `PERMISSION_DENIED` |
| **PAYLOAD-04** | Self-Approval Bypass | `/applications/{attackerAppId}` | Applicant attempts to update application status to `approved`. | `PERMISSION_DENIED` |
| **PAYLOAD-05** | Unauthorized Publishing | `/articles/{articleId}` | Member author attempts to set `status = 'published'` directly on their own submission. | `PERMISSION_DENIED` |
| **PAYLOAD-06** | Bank Detail Tampering | `/donation_config/published` | Unauthenticated or member user attempts to replace sort code or account number with a personal account. | `PERMISSION_DENIED` |
| **PAYLOAD-07** | Draft Hijacking | `/articles/{victimDraftId}` | Attacker attempts to read or mutate another author's unpublished draft. | `PERMISSION_DENIED` |
| **PAYLOAD-08** | Audit Log Deletion | `/audit_logs/{logId}` | Attacker attempts to delete or alter evidence of an administrative action. | `PERMISSION_DENIED` |
| **PAYLOAD-09** | Enquiries Data Extraction | `/contact_enquiries` | Non-admin user attempts to list or query all private contact enquiries submitted by the public. | `PERMISSION_DENIED` |
| **PAYLOAD-10** | Chapter Defacement | `/chapters/london` | Non-admin attempts to overwrite coordinator name or description of a city chapter. | `PERMISSION_DENIED` |
| **PAYLOAD-11** | ID Poisoning Attack | `/users/very_long_invalid_junk_id!@#$%^&*()` | Attacker attempts to inject non-alphanumeric or massive IDs (>128 chars). | `PERMISSION_DENIED` |
| **PAYLOAD-12** | Forced Public Listing | `/public_profiles/{victimUid}` | Attacker attempts to forge a public profile for a member who did not consent to directory visibility. | `PERMISSION_DENIED` |

---

## 3. Enforcement & Testing

These invariants are enforced by `firestore.rules` and verified by
`tests/firestore.rules.test.ts`, which runs every attack case above (and
more) against the Firestore emulator.

- Run locally: `npm run test:rules` (needs Java 11+ for the emulator).
- Runs automatically on every pull request via `.github/workflows/ci.yml`.

Additional invariants now enforced:

- **Private by default**: `/users`, `/members`, `/applications` and
  `/user_activities` are readable only by the person themselves and
  authorised staff. Activity records carry no email address.
- **Opt-in directory**: a member can publish `/public_profiles/{uid}` only when
  their own `/members/{uid}` record has `consentToDirectory == true`. Bulk
  import and manual enrolment default to *no consent*.
- **Verified bootstrap owners**: the bootstrap owner emails grant rights only
  when `email_verified == true`.
- **No self-awarded points**: points are written only by staff, in a single
  transaction that updates the activity record, `users/{uid}.activityScore`
  and the public leaderboard score together.
- **Honest counters**: views and shares move by exactly +1; likes require a
  per-user `/articles/{id}/likes/{uid}` document written in the same batch, so
  each member can like an article once.
- **Notifications**: only users with the `manage_notifications` permission
  (or administrators) can create, edit or delete notifications; users cannot
  grant themselves that permission. Drafts and members-only notifications are
  not publicly readable.
- **Single bootstrap owner**: only `dashtiozar@gmail.com` (verified) is
  recognised by email; every other administrator is granted via `/admins`.
