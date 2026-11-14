# YAD Center — Supabase backend

This folder documents the database foundation and the current staging workflow.

## Current database state
- `schema.sql` is the original base schema.
- `upgrade-client-choice-payment-first.sql` is the consolidated upgrade for the current therapist-selection and payment-first workflow.
- Both the base schema and the upgrade sequence have been applied to the connected Supabase **test project**. The migration history is recorded in Supabase. Do not run either script again on that project.
- The GitHub branch is `yadcenter-seo-redesign`; no changes have been merged to `main`.

## Current business workflow
1. The administrator receives therapist details, photo, qualifications and professional-license evidence outside the public client workflow.
2. The administrator creates the therapist profile, uploads the public photo and private license document, verifies the credentials, and publishes the profile.
3. A client signs in and chooses a listed, verified therapist from the public directory.
4. The request and payment are created before any appointment is scheduled.
5. The client receives payment instructions from YAD Center, transfers the amount, and submits a payment reference.
6. The administrator checks the actual receipt. Approval marks the request as payment-verified; it does not create or confirm an appointment.
7. The administrator schedules the session with the therapist selected by the client.
8. The database records the current 60% therapist / 40% YAD Center split at request creation.

Therapists do not need Supabase Auth accounts and cannot self-register, edit or publish profiles. The public directory exposes only profiles that are both verified and listed.

## Storage and access boundaries
- `therapist-photos` is a public bucket for profile photos; only an authenticated YAD administrator can upload, replace or delete objects.
- `therapist-documents` is a private bucket for license evidence; only an authenticated YAD administrator can read or manage objects.
- License numbers and document paths are stored separately from the public therapist profile.
- The service-role/secret key is never used in browser code. The browser uses only the publishable key with RLS and role-checked RPCs.
- New requests, therapist management, payment review and scheduling are handled through RPCs that verify the caller's database role.

## Languages
The public homepage and portal language controls expose Persian, Kurdish, English, Turkish, Arabic, Spanish, German and French. The homepage, assistant interface and FAQ responses, therapist collaboration/proposal interface, article index, and selected client/admin labels are localized. Full localization is not complete: the legal policy body and the full text of the three articles remain Persian (the interface now discloses this when another language is selected), and many admin event-management labels still need translation. Do not advertise the site as fully translated until all content receives human-reviewed translations.

## Validation completed
- Database migrations applied and recorded in Supabase.
- Therapist profile creation and market-price configuration tested through the admin RPC; test profile removed.
- End-to-end database smoke test completed for client selection, request creation, payment-reference submission, admin payment approval, scheduling with the selected therapist, and the 60/40 split. Temporary rows were removed and the admin role was restored.
- Anonymous execution of therapist-management and client-request creation RPCs is denied.
- Public directory query cannot reveal unverified/unlisted therapist profiles.
- Security advisors still report intentional warnings for role-checked SECURITY DEFINER RPCs callable by authenticated users, the public therapist-proposal endpoint (protected by input validation and a per-email rate limit), and no-policy tables such as `payout_accounts`, `site_settings`, `workshop_proposals` and `workshop_registrations` that are deliberately inaccessible through direct browser table access. The `btree_gist` extension has been moved to `extensions`.
- A transaction-based privilege check confirmed that an authenticated user cannot change their own profile role through the API, and an account without the admin role is rejected by an admin-only workshop mutation RPC.
- The Supabase Auth advisor still reports leaked-password protection disabled. This project setting must be enabled in the Supabase Dashboard under Authentication → Password security; the available project connector cannot change that Auth setting. Supabase documentation currently lists this protection as available on Pro and above: https://supabase.com/docs/guides/auth/password-security.
- GitHub static validation has passed. A Playwright browser smoke-test job has passed on commit `8d3dd68`: all ten pages returned HTTP 200, the homepage and client English language switches worked, the PWA manifest/icon and service worker loaded, and no uncaught page errors were detected. The expanded Playwright run passed on commit `aebc2d3`: it checked all eight homepage/client language options, the assistant, therapist collaboration page, article index, Persian-only notices on legal/article pages, PWA assets, and uncaught browser errors.
- Browser smoke tests do not replace a real authenticated end-to-end test against Supabase or a manual visual review on mobile and desktop.

## Before production
- This is still a staging system, not ready for real clients or clinical records.
- Manual payment references are not bank verification. An administrator must independently verify actual receipt before approval.
- Online payment gateways, refunds, notifications, cancellations, payout execution and reconciliation are not implemented.
- Supabase Auth leaked-password protection is not enabled: this project is on the Free plan, and Supabase rejects saving this setting unless the project is Pro or above. Do not treat a failed save as enabled.
- The YAD Center administrator account must enroll a TOTP factor in the application itself. This is separate from MFA on the Supabase dashboard owner account. The admin sign-in screen guides first-time enrollment and later challenges.
- Admin SECURITY DEFINER RPCs require both `profiles.role = 'admin'` and the JWT assurance claim `aal2` through `public.require_admin_aal2()`. The guard is enforced at the start of all 15 admin RPCs; private therapist verification reads and admin storage operations also require AAL2. The Supabase advisor may still report these authenticated SECURITY DEFINER RPCs because they are callable at the grant layer, but non-admin or AAL1 requests are rejected by the function body.
- Add monitoring, backups, rate limits and audit logging.
- Complete a browser end-to-end test suite and an independent security review.
- Obtain legal/privacy review for consent, data retention, cross-border processing, refunds, professional licensing and emergency procedures.
- Do not store clinical notes or sensitive patient records until a separate legally reviewed clinical-record architecture is implemented.


## Workshops and educational events

After the base schema and `upgrade-client-choice-payment-first.sql`, apply
`workshops-events.sql` to create the managed workshop workflow.

- Therapists submit a proposal through the public proposal form; only administrators can review it and publish an event.
- Public visitors can view published event details. Registration requires a client account.
- Free registrations become active immediately. Paid registrations remain pending until the administrator verifies the payment reference.
- Meeting URLs and passwords are not granted to anonymous/public table readers. The client registration RPC reveals them only to the registering client after a free registration or administrator-confirmed payment.
- Event publishing, proposal decisions, participant rosters, and payment confirmation are administrator-only RPCs.
- The proposal endpoint is intentionally callable by anonymous visitors only; authenticated users do not receive execute permission. It has a basic per-email rate limit, but this can be bypassed with multiple email addresses. Add CAPTCHA/abuse monitoring and test it under expected traffic before broad public promotion.
- The proposal/registration tables intentionally have no direct client SELECT policies; reads are mediated through narrowly scoped RPCs. `payout_accounts` and `site_settings` also deny direct table access until dedicated server-side admin workflows are implemented.
- Zoom/Meet links are entered and managed by the administrator; the platform does not create third-party meetings automatically.


## Administrator MFA (AAL2)

Apply the following migrations after the workshop workflow migrations:

1. `admin-mfa-aal2.sql` creates the shared admin role + AAL2 guard and adds restrictive policies for private therapist verification records and admin storage operations.
2. `admin-mfa-aal2-sql-rpcs.sql` converts the SQL-language admin list RPCs to PL/pgSQL so the guard executes before querying, including when result tables are empty.

The administrator signs into `admin.html` using the application Auth user, then enrolls a TOTP authenticator through the in-app QR code or manual setup key and verifies a six-digit code. The project-owner MFA configured at `/dashboard/account/security` is a separate identity and does not enroll the application Auth user. Never share the TOTP setup key or generated codes. Add a separate backup TOTP factor before production; the current admin UI does not yet provide factor-management or backup-factor enrollment.

AAL2 enforcement has been exercised in database-level tests using simulated JWT claims. This does not replace a live browser test using the actual admin Auth user and authenticator app.
