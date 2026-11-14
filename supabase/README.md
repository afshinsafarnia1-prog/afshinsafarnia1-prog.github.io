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
The public homepage and portal language controls currently expose Persian, Kurdish, English, Turkish, Arabic, Spanish, German and French. Translation coverage is partial: some secondary page content, article text, and newer admin/client form labels still need full localization.

## Validation completed
- Database migrations applied and recorded in Supabase.
- Therapist profile creation and market-price configuration tested through the admin RPC; test profile removed.
- End-to-end database smoke test completed for client selection, request creation, payment-reference submission, admin payment approval, scheduling with the selected therapist, and the 60/40 split. Temporary rows were removed and the admin role was restored.
- Anonymous execution of therapist-management and client-request creation RPCs is denied.
- Public directory query cannot reveal unverified/unlisted therapist profiles.
- Security advisors still report intentional warnings for role-checked SECURITY DEFINER RPCs callable by authenticated users, the existing `btree_gist` extension in the public schema, and no-policy tables such as `payout_accounts` and `site_settings` that are deliberately inaccessible through direct browser access.
- GitHub static workflow checks and browser-level end-to-end tests for the new pages have not yet been verified.

## Before production
- This is still a staging system, not ready for real clients or clinical records.
- Manual payment references are not bank verification. An administrator must independently verify actual receipt before approval.
- Online payment gateways, refunds, notifications, cancellations, payout execution and reconciliation are not implemented.
- Add MFA for administrators, monitoring, backups, rate limits and audit logging.
- Complete a browser end-to-end test suite and an independent security review.
- Obtain legal/privacy review for consent, data retention, cross-border processing, refunds, professional licensing and emergency procedures.
- Do not store clinical notes or sensitive patient records until a separate legally reviewed clinical-record architecture is implemented.
