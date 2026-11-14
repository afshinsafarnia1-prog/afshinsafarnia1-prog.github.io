-- YAD Center: require a verified Supabase MFA factor (AAL2) for every admin RPC.
-- This migration affects only the connected TEST project when explicitly applied.

create or replace function public.require_admin_aal2()
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if auth.uid() is null
     or not exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
     ) then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  if (auth.jwt() ->> 'aal') is distinct from 'aal2' then
    raise exception 'admin_mfa_required' using errcode = '42501';
  end if;

  return true;
end;
$function$;

revoke all on function public.require_admin_aal2() from public, anon;
grant execute on function public.require_admin_aal2() to authenticated;

-- Add the AAL2 guard to every existing SECURITY DEFINER admin RPC.
do $migration$
declare
  r record;
  v_definition text;
  v_updated text;
begin
  for r in
    select p.oid, p.proname, l.lanname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
      and left(p.proname, 6) = 'admin_'
      and p.prosecdef
  loop
    v_definition := pg_get_functiondef(r.oid);

    if r.lanname = 'plpgsql' then
      v_updated := regexp_replace(
        v_definition,
        E'(\n[[:space:]]*BEGIN[[:space:]]*\n)',
        E'\1  PERFORM public.require_admin_aal2();\n',
        'i'
      );
    elsif r.lanname = 'sql' then
      v_updated := regexp_replace(
        v_definition,
        '(WHERE[[:space:]]+EXISTS[[:space:]]*\()',
        'WHERE public.require_admin_aal2() AND EXISTS (',
        'i'
      );
    else
      raise exception 'Unsupported language for admin RPC %: %', r.proname, r.lanname;
    end if;

    if v_updated = v_definition or position('require_admin_aal2' in v_updated) = 0 then
      raise exception 'Could not add MFA guard to admin RPC %', r.proname;
    end if;

    execute v_updated;
  end loop;
end;
$migration$;

-- Sensitive therapist verification documents require AAL2 for admin reads.
drop policy if exists therapist_verification_requires_aal2
  on public.therapist_private_verification;
create policy therapist_verification_requires_aal2
  on public.therapist_private_verification
  as restrictive
  for select
  to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');

-- Admin uploads/downloads/deletes in private therapist buckets require AAL2.
-- Non-admin authenticated users are unaffected by this restrictive policy.
drop policy if exists admin_storage_requires_aal2 on storage.objects;
create policy admin_storage_requires_aal2
  on storage.objects
  as restrictive
  for all
  to authenticated
  using (
    not exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    not exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );
