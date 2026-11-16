
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
  if coalesce(p_verified,false) or coalesce(p_is_listed,false) then
    raise exception 'use_admin_verify_therapist_after_documented_checks' using errcode = '23514';
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
    null, false, now()
  )
  on conflict (id) do update set
    public_slug=excluded.public_slug, display_name=excluded.display_name,
    headline=excluded.headline, biography=excluded.biography,
    qualifications=excluded.qualifications, specialties=excluded.specialties,
    languages=excluded.languages, modalities=excluded.modalities,
    session_duration_minutes=excluded.session_duration_minutes,
    fee_amount=excluded.fee_amount, fee_currency=excluded.fee_currency,
    photo_path=excluded.photo_path, verified_at=null,
    is_listed=false, updated_at=now();

  insert into public.therapist_private_verification (
    therapist_id, license_number, issuing_authority, document_path,
    verified_by, updated_at
  ) values (
    v_id, p_license_number,
    'سازمان نظام روان‌شناسی و مشاوره جمهوری اسلامی ایران',
    p_document_path, v_admin, now()
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
