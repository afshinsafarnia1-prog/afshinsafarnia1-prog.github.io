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
