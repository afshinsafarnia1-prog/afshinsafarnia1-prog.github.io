# YAD Center backend foundation

This folder is a **database/security starting point**, not a live backend.

## What is included
- PostgreSQL schema for profiles and three roles (client, therapist, admin)
- Therapist directory, availability, appointments and payment records
- Private payout-account configuration table for domestic and international accounts
- Row-level security policies with intentionally restricted writes

## Before connecting a real site
1. Create a Supabase project in a region/provider that is legally and technically accessible to the operator and intended users. Check current access from Iran, sanctions, payment-provider terms, data residency and applicable privacy law before selecting a provider.
2. Review `schema.sql` with a qualified backend/security engineer. Apply it only to a new test project first.
3. Configure email/phone authentication, recovery, MFA for admins, backups, monitoring and retention.
4. Implement server-side functions for admin role assignment, therapist verification, appointment state transitions, payment-provider webhooks, refunds and payout-account encryption.
5. Keep the Supabase service-role key and encryption key in server-side environment secrets only. Never place them in HTML, JavaScript served to browsers, GitHub, or the PWA.
6. Add tests for role escalation, cross-user access, therapist/client data isolation, duplicate bookings, payment replay, and unauthorized payout changes.
7. Have a privacy/legal professional review consent, clinical-data handling, retention, cancellation/refund and emergency policies before production.

## Important limitations
- This schema does not create a working booking or payment system by itself.
- The public site should not store clinical notes or therapy records until a secure, legally reviewed clinical-record design is in place.
- Payout account identifiers are represented as encrypted text. Encryption/decryption must occur only in a trusted server-side function using a key held outside the database.
- The current website FAQ helper remains a non-clinical guide, not a therapist or diagnostic service.


## Two-market model (Iran + international)
- The first version is designed to support both markets at the same time, not as a later migration.
- Profiles and appointments carry a market and timezone; therapist pricing can be configured separately per market and currency.
- Iran-facing checkout should use a locally available, legally compliant payment provider and settle in IRR.
- International checkout should use a provider that is legally available to the business and the client's country, with EUR/USD as supported display/settlement currencies where the provider permits.
- Do not assume one provider can process both markets. Provider availability, sanctions, banking, merchant eligibility and data-location rules must be checked before implementation.
- The current market selector is only a front-end preference indicator. It does not yet change the actual payment route or convert currencies.


## Manual payment workflow included in schema
- `request_appointment` locks and reserves an available future slot, checks that the therapist is listed and verified, reads the active market-specific price, and creates a pending appointment plus pending payment.
- `submit_manual_payment_reference` lets the client submit a bank transfer reference. Do not ask clients to upload sensitive clinical information with payment evidence.
- `admin_review_manual_payment` lets an authenticated profile whose role is already `admin` approve or reject a submitted manual payment. Approval confirms the appointment; rejection cancels it and reopens the slot.
- Create the first admin profile manually through a trusted Supabase SQL console after verifying the account owner. Never expose an admin role-setting endpoint to public clients.
- This is a database workflow foundation; the current static HTML portals do not yet include live authentication screens or call these RPCs. Connect those only after the Supabase project and secrets are configured.
- The initial schema includes a legacy single-currency fee on `therapists`; use `therapist_prices` as the authoritative market-specific price table. The legacy columns are retained for backward compatibility and should not be used for checkout.
