
alter table public.therapist_private_verification
  add column if not exists registry_checked_at timestamptz,
  add column if not exists registry_reference text,
  add column if not exists psychotherapy_scope_verified_at timestamptz,
  add column if not exists psychotherapy_scope_evidence_reference text,
  add column if not exists jurisdiction_reviewed_at timestamptz,
  add column if not exists jurisdiction_review_reference text,
  add column if not exists license_expires_at date,
  add column if not exists approved_jurisdictions text[] not null default '{}';

create or replace function public.enforce_therapist_verification_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
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
    new.is_listed := false;
    new.practice_jurisdictions := '{}';
    new.accepting_new_clients := false;
  end if;
  if new.is_listed and new.verified_at is null then
    raise exception 'verification_required_before_publication' using errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enforce_therapist_verification_evidence on public.therapists;
create trigger trg_enforce_therapist_verification_evidence
before insert or update of verified_at, is_listed, practice_jurisdictions, accepting_new_clients
on public.therapists
for each row execute function public.enforce_therapist_verification_evidence();

create or replace function public.admin_verify_therapist(
  p_therapist_id uuid,
  p_license_number text,
  p_license_expires_at date,
  p_registry_reference text,
  p_psychotherapy_scope_evidence_reference text,
  p_jurisdiction_review_reference text,
  p_approved_jurisdictions text[],
  p_years_experience integer,
  p_accepting_new_clients boolean,
  p_publish boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := auth.uid();
  v_countries text[] := coalesce(p_approved_jurisdictions, '{}');
begin
  perform public.require_admin_aal2();
  if v_admin is null or not exists (
    select 1 from public.profiles p where p.id = v_admin and p.role = 'admin'
  ) then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  if p_therapist_id is null or not exists (
    select 1 from public.therapists t where t.id = p_therapist_id
  ) then
    raise exception 'therapist_not_found' using errcode = '22023';
  end if;
  if nullif(btrim(p_license_number), '') is null
     or length(btrim(p_license_number)) > 120
     or nullif(btrim(p_registry_reference), '') is null
     or length(btrim(p_registry_reference)) < 8
     or length(p_registry_reference) > 2000
     or nullif(btrim(p_psychotherapy_scope_evidence_reference), '') is null
     or length(btrim(p_psychotherapy_scope_evidence_reference)) < 8
     or length(p_psychotherapy_scope_evidence_reference) > 2000
     or nullif(btrim(p_jurisdiction_review_reference), '') is null
     or length(btrim(p_jurisdiction_review_reference)) < 8
     or length(p_jurisdiction_review_reference) > 4000 then
    raise exception 'verification_references_required' using errcode = '22023';
  end if;
  if p_license_expires_at is not null and p_license_expires_at < current_date then
    raise exception 'license_expired' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.therapist_private_verification v
    where v.therapist_id = p_therapist_id
      and nullif(btrim(v.document_path), '') is not null
  ) then
    raise exception 'license_document_required' using errcode = '22023';
  end if;
  if cardinality(v_countries) = 0
     or exists (select 1 from unnest(v_countries) c where c !~ '^[A-Z]{2}$') then
    raise exception 'approved_jurisdictions_required_as_iso_country_codes' using errcode = '22023';
  end if;
  if p_years_experience is not null and p_years_experience not between 0 and 60 then
    raise exception 'invalid_years_experience' using errcode = '22023';
  end if;

  insert into public.therapist_private_verification (
    therapist_id, license_number, issuing_authority, verified_by, updated_at,
    registry_checked_at, registry_reference,
    psychotherapy_scope_verified_at, psychotherapy_scope_evidence_reference,
    jurisdiction_reviewed_at, jurisdiction_review_reference,
    license_expires_at, approved_jurisdictions
  ) values (
    p_therapist_id, btrim(p_license_number),
    'سازمان نظام روان‌شناسی و مشاوره جمهوری اسلامی ایران',
    v_admin, now(), now(), btrim(p_registry_reference),
    now(), btrim(p_psychotherapy_scope_evidence_reference),
    now(), btrim(p_jurisdiction_review_reference),
    p_license_expires_at, v_countries
  )
  on conflict (therapist_id) do update set
    license_number = excluded.license_number,
    issuing_authority = excluded.issuing_authority,
    verified_by = excluded.verified_by,
    updated_at = now(),
    registry_checked_at = now(),
    registry_reference = excluded.registry_reference,
    psychotherapy_scope_verified_at = now(),
    psychotherapy_scope_evidence_reference = excluded.psychotherapy_scope_evidence_reference,
    jurisdiction_reviewed_at = now(),
    jurisdiction_review_reference = excluded.jurisdiction_review_reference,
    license_expires_at = excluded.license_expires_at,
    approved_jurisdictions = excluded.approved_jurisdictions;

  update public.therapists
  set verified_at = now(),
      is_listed = coalesce(p_publish, false),
      practice_jurisdictions = v_countries,
      accepting_new_clients = coalesce(p_accepting_new_clients, false) and coalesce(p_publish, false),
      years_experience = p_years_experience,
      updated_at = now()
  where id = p_therapist_id;
end;
$function$;

create or replace function public.admin_list_therapist_public_metadata()
returns table(
  therapist_id uuid,
  years_experience integer,
  practice_jurisdictions text[],
  accepting_new_clients boolean,
  license_number text,
  issuing_authority text,
  document_path text,
  license_expires_at date,
  registry_reference text,
  psychotherapy_scope_evidence_reference text,
  jurisdiction_review_reference text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := auth.uid();
begin
  perform public.require_admin_aal2();
  if v_admin is null or not exists (
    select 1 from public.profiles p where p.id = v_admin and p.role = 'admin'
  ) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return query
  select t.id, t.years_experience, t.practice_jurisdictions, t.accepting_new_clients,
         v.license_number, v.issuing_authority, v.document_path, v.license_expires_at,
         v.registry_reference, v.psychotherapy_scope_evidence_reference,
         v.jurisdiction_review_reference
  from public.therapists t
  left join public.therapist_private_verification v on v.therapist_id = t.id
  order by t.display_name;
end;
$function$;

revoke all on function public.admin_verify_therapist(uuid,text,date,text,text,text,text[],integer,boolean,boolean) from public, anon;
revoke all on function public.admin_list_therapist_public_metadata() from public, anon;
grant execute on function public.admin_verify_therapist(uuid,text,date,text,text,text,text[],integer,boolean,boolean) to authenticated;
grant execute on function public.admin_list_therapist_public_metadata() to authenticated;

create or replace function public.admin_save_therapist(
  p_therapist_id uuid,
  p_public_slug text,
  p_display_name text,
  p_headline text,
  p_biography text,
  p_qualifications text[],
  p_specialties text[],
  p_languages text[],
  p_modalities text[],
  p_session_duration_minutes integer,
  p_fee_amount bigint,
  p_fee_currency text,
  p_photo_path text,
  p_license_number text,
  p_issuing_authority text,
  p_document_path text,
  p_verified boolean,
  p_is_listed boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := auth.uid();
  v_id uuid := coalesce(p_therapist_id, gen_random_uuid());
begin
  perform public.require_admin_aal2();
  if v_admin is null or not exists (
    select 1 from public.profiles p where p.id = v_admin and p.role = 'admin'
  ) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if nullif(trim(p_public_slug),'') is null
     or nullif(trim(p_display_name),'') is null then
    raise exception 'therapist_name_and_slug_required' using errcode = '22023';
  end if;
  if p_session_duration_minutes not between 20 and 180
     or p_fee_amount < 0
     or p_fee_currency not in ('IRR','EUR','USD') then
    raise exception 'invalid_therapist_terms' using errcode = '22023';
  end if;
  if coalesce(p_is_listed,false) and not coalesce(p_verified,false) then
    raise exception 'verification_required_before_publication' using errcode = '22023';
  end if;
  if coalesce(p_verified,false) and not exists (
    select 1 from public.therapist_private_verification v
    where v.therapist_id = v_id
      and v.license_number = btrim(coalesce(p_license_number,''))
      and nullif(btrim(p_document_path), '') is not null
      and p_issuing_authority = 'سازمان نظام روان‌شناسی و مشاوره جمهوری اسلامی ایران'
      and v.document_path is not null
      and v.issuing_authority = 'سازمان نظام روان‌شناسی و مشاوره جمهوری اسلامی ایران'
      and v.registry_checked_at is not null
      and nullif(btrim(v.registry_reference),'') is not null
      and v.psychotherapy_scope_verified_at is not null
      and nullif(btrim(v.psychotherapy_scope_evidence_reference),'') is not null
      and v.jurisdiction_reviewed_at is not null
      and nullif(btrim(v.jurisdiction_review_reference),'') is not null
      and cardinality(v.approved_jurisdictions) > 0
      and (v.license_expires_at is null or v.license_expires_at >= current_date)
  ) then
    raise exception 'official_license_scope_and_jurisdiction_verification_required' using errcode = '23514';
  end if;

  insert into public.therapists (
    id, public_slug, display_name, headline, biography, qualifications,
    specialties, languages, modalities, session_duration_minutes,
    fee_amount, fee_currency, photo_path, verified_at, is_listed, updated_at
  ) values (
    v_id, lower(trim(p_public_slug)), trim(p_display_name),
    coalesce(p_headline,''), coalesce(p_biography,''),
    coalesce(p_qualifications,'{}'), coalesce(p_specialties,'{}'),
    coalesce(p_languages,'{fa}'), coalesce(p_modalities,'{}'),
    p_session_duration_minutes, p_fee_amount, p_fee_currency, p_photo_path,
    case when p_verified then now() else null end,
    coalesce(p_is_listed,false), now()
  )
  on conflict (id) do update set
    public_slug=excluded.public_slug, display_name=excluded.display_name,
    headline=excluded.headline, biography=excluded.biography,
    qualifications=excluded.qualifications, specialties=excluded.specialties,
    languages=excluded.languages, modalities=excluded.modalities,
    session_duration_minutes=excluded.session_duration_minutes,
    fee_amount=excluded.fee_amount, fee_currency=excluded.fee_currency,
    photo_path=excluded.photo_path, verified_at=excluded.verified_at,
    is_listed=excluded.is_listed, updated_at=now();

  insert into public.therapist_private_verification (
    therapist_id, license_number, issuing_authority, document_path,
    verified_by, updated_at
  ) values (
    v_id, p_license_number, p_issuing_authority, p_document_path,
    v_admin, now()
  )
  on conflict (therapist_id) do update set
    license_number=excluded.license_number,
    issuing_authority=excluded.issuing_authority,
    document_path=coalesce(excluded.document_path, public.therapist_private_verification.document_path),
    verified_by=excluded.verified_by, updated_at=now();

  return v_id;
end;
$function$;

revoke all on function public.admin_save_therapist(uuid,text,text,text,text,text[],text[],text[],text[],integer,bigint,text,text,text,text,text,boolean,boolean) from public, anon;
grant execute on function public.admin_save_therapist(uuid,text,text,text,text,text[],text[],text[],text[],integer,bigint,text,text,text,text,text,boolean,boolean) to authenticated;
