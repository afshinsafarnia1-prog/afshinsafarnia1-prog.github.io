-- Least-privilege browser access for YAD Center.
-- Browser code reads only a user's own profile, the published/verified
-- therapist directory, and published workshops directly. Sensitive workflows
-- use narrowly scoped SECURITY DEFINER RPCs with ownership/role checks.
revoke all privileges on all tables in schema public from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.therapists to anon, authenticated;
grant select on table public.workshops to anon, authenticated;
