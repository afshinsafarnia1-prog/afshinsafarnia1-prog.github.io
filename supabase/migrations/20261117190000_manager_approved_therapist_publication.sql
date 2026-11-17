-- Separate administrative publication approval from professional credential verification.
alter table public.therapists
  add column if not exists manager_approved boolean not null default false,
  add column if not exists manager_approved_at timestamptz;

create or replace function public.enforce_therapist_verification_evidence()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.manager_approved then
    new.manager_approved_at := coalesce(new.manager_approved_at, now());
  else
    new.manager_approved_at := null;
  end if;

  if new.verified_at is not null then
    if not exists (
      select 1
      from public.therapist_private_verification v
      where v.therapist_id = new.id
        and nullif(btrim(v.license_number), '') is not null
        and nullif(btrim(v.document_path), '') is not null
        and v.issuing_authority = 'سازمان نظام روان‌شناسی و مشاوره جمهوری اسلامی ایران'
        and v.registry_checked_at is not null
        and nullif(btrim(v.registry_reference), '') is not null
        and v.psychotherapy_scope_verified_at is not null
        and nullif(btrim(v.psychotherapy_scope_evidence_reference), '') is not null
        and v.jurisdiction_reviewed_at is not null
        and nullif(btrim(v.jurisdiction_review_reference), '') is not null
        and cardinality(v.approved_jurisdictions) > 0
        and (v.license_expires_at is null or v.license_expires_at >= current_date)
    ) then
      raise exception 'therapist_verification_evidence_required' using errcode = '23514';
    end if;
  else
    -- Manager-approved profiles may be listed, but never appear to accept bookings
    -- or claim a verified practice jurisdiction before credential checks.
    new.practice_jurisdictions := '{}';
    new.accepting_new_clients := false;
    if not new.manager_approved then
      new.is_listed := false;
    end if;
  end if;

  if new.is_listed and new.verified_at is null and not new.manager_approved then
    raise exception 'manager_or_professional_verification_required' using errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enforce_therapist_verification_evidence on public.therapists;
create trigger trg_enforce_therapist_verification_evidence
before insert or update of verified_at, is_listed, practice_jurisdictions,
  accepting_new_clients, manager_approved, manager_approved_at
on public.therapists
for each row execute function public.enforce_therapist_verification_evidence();

drop policy if exists therapist_public_directory on public.therapists;
create policy therapist_public_directory on public.therapists
for select to anon, authenticated
using (is_listed and (verified_at is not null or manager_approved));

create or replace function public.get_public_therapist_fee_directory()
returns table(therapist_id uuid, currency text, amount bigint, session_duration_minutes integer)
language sql stable security definer
set search_path = ''
as $function$
  select f.therapist_id,f.currency,f.amount,f.session_duration_minutes
  from public.therapist_fees f
  join public.therapists t on t.id=f.therapist_id
  where t.is_listed and (t.verified_at is not null or t.manager_approved)
  order by f.therapist_id,f.currency;
$function$;

create or replace function public.get_public_therapist_fees(p_therapist_id uuid)
returns table(currency text, amount bigint, session_duration_minutes integer)
language sql stable security definer
set search_path = ''
as $function$
  select f.currency,f.amount,f.session_duration_minutes
  from public.therapist_fees f
  join public.therapists t on t.id=f.therapist_id
  where f.therapist_id=p_therapist_id
    and t.is_listed and (t.verified_at is not null or t.manager_approved)
  order by case f.currency when 'IRR' then 1 when 'EUR' then 2 when 'USD' then 3 else 4 end;
$function$;

create or replace function public.get_public_therapist_directory_metadata()
returns table(therapist_id uuid, years_experience integer, practice_jurisdictions text[], accepting_new_clients boolean)
language sql stable security definer
set search_path = ''
as $function$
  select t.id, t.years_experience, t.practice_jurisdictions, t.accepting_new_clients
  from public.therapists t
  where t.is_listed = true
    and (t.verified_at is not null or t.manager_approved)
  order by t.display_name;
$function$;

create or replace function public.get_public_therapist_public_metadata(p_therapist_id uuid)
returns table(years_experience integer, practice_jurisdictions text[], accepting_new_clients boolean)
language sql stable security definer
set search_path = ''
as $function$
  select t.years_experience, t.practice_jurisdictions, t.accepting_new_clients
  from public.therapists t
  where t.id = p_therapist_id
    and t.is_listed = true
    and (t.verified_at is not null or t.manager_approved);
$function$;

-- Publish only the specific therapist approved by the site manager.
update public.therapists
set manager_approved = true,
    manager_approved_at = coalesce(manager_approved_at, now()),
    is_listed = true,
    accepting_new_clients = false,
    practice_jurisdictions = '{}',
    updated_at = now()
where public_slug = 'foruzan-shahla'
  and verified_at is null;
