create or replace function public.admin_save_therapist(
 p_therapist_id uuid,p_public_slug text,p_display_name text,p_headline text,p_biography text,
 p_qualifications text[],p_specialties text[],p_languages text[],p_modalities text[],
 p_session_duration_minutes integer,p_fee_amount bigint,p_fee_currency text,p_photo_path text,
 p_license_number text,p_issuing_authority text,p_document_path text,p_verified boolean,p_is_listed boolean
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_admin uuid:=auth.uid(); v_id uuid:=coalesce(p_therapist_id,gen_random_uuid());
begin
 perform public.require_admin_aal2();
 if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then raise exception 'admin_only' using errcode='42501'; end if;
 if nullif(trim(p_public_slug),'') is null or nullif(trim(p_display_name),'') is null then raise exception 'therapist_name_and_slug_required' using errcode='22023'; end if;
 if p_session_duration_minutes not between 20 and 180 or p_fee_amount<0 or p_fee_currency not in ('IRR','EUR','USD') then raise exception 'invalid_therapist_terms' using errcode='22023'; end if;
 if nullif(trim(p_issuing_authority),'') is null or length(p_issuing_authority)>240 then raise exception 'issuing_authority_required' using errcode='22023'; end if;
 if coalesce(p_verified,false) or coalesce(p_is_listed,false) then raise exception 'use_admin_verify_therapist_after_documented_checks' using errcode='23514'; end if;
 insert into public.therapists(id,public_slug,display_name,headline,biography,qualifications,specialties,languages,modalities,session_duration_minutes,fee_amount,fee_currency,photo_path,verified_at,is_listed,updated_at)
 values(v_id,lower(trim(p_public_slug)),trim(p_display_name),coalesce(p_headline,''),coalesce(p_biography,''),coalesce(p_qualifications,'{}'),coalesce(p_specialties,'{}'),coalesce(p_languages,'{fa}'),coalesce(p_modalities,'{}'),p_session_duration_minutes,p_fee_amount,p_fee_currency,p_photo_path,null,false,now())
 on conflict(id) do update set public_slug=excluded.public_slug,display_name=excluded.display_name,headline=excluded.headline,biography=excluded.biography,qualifications=excluded.qualifications,specialties=excluded.specialties,languages=excluded.languages,modalities=excluded.modalities,session_duration_minutes=excluded.session_duration_minutes,fee_amount=excluded.fee_amount,fee_currency=excluded.fee_currency,photo_path=excluded.photo_path,verified_at=null,is_listed=false,updated_at=now();
 insert into public.therapist_private_verification(therapist_id,license_number,issuing_authority,document_path,verified_by,updated_at)
 values(v_id,p_license_number,trim(p_issuing_authority),p_document_path,v_admin,now())
 on conflict(therapist_id) do update set license_number=excluded.license_number,issuing_authority=excluded.issuing_authority,document_path=coalesce(excluded.document_path,public.therapist_private_verification.document_path),verified_by=excluded.verified_by,updated_at=now();
 return v_id;
end; $$;
revoke all on function public.admin_save_therapist(uuid,text,text,text,text,text[],text[],text[],text[],integer,bigint,text,text,text,text,text,boolean,boolean) from public,anon;
grant execute on function public.admin_save_therapist(uuid,text,text,text,text,text[],text[],text[],text[],integer,bigint,text,text,text,text,text,boolean,boolean) to authenticated;

-- Preserve the jurisdiction-specific licensing authority recorded by the admin.
-- Verification must not silently overwrite it with an Iran-only regulator name.
create or replace function public.admin_verify_therapist(
 p_therapist_id uuid,p_license_number text,p_license_expires_at date,
 p_registry_reference text,p_psychotherapy_scope_evidence_reference text,
 p_jurisdiction_review_reference text,p_approved_jurisdictions text[],
 p_years_experience integer,p_accepting_new_clients boolean,p_publish boolean
) returns void language plpgsql security definer set search_path=''
as $function$
declare
 v_admin uuid:=auth.uid();
 v_countries text[]:=coalesce(p_approved_jurisdictions,'{}');
 v_issuing_authority text;
begin
 perform public.require_admin_aal2();
 if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
  raise exception 'admin_only' using errcode='42501';
 end if;
 if p_therapist_id is null or not exists(select 1 from public.therapists t where t.id=p_therapist_id) then
  raise exception 'therapist_not_found' using errcode='22023';
 end if;
 if nullif(btrim(p_license_number),'') is null or length(btrim(p_license_number))>120
    or nullif(btrim(p_registry_reference),'') is null or length(btrim(p_registry_reference))<8 or length(p_registry_reference)>2000
    or nullif(btrim(p_psychotherapy_scope_evidence_reference),'') is null or length(btrim(p_psychotherapy_scope_evidence_reference))<8 or length(p_psychotherapy_scope_evidence_reference)>2000
    or nullif(btrim(p_jurisdiction_review_reference),'') is null or length(btrim(p_jurisdiction_review_reference))<8 or length(p_jurisdiction_review_reference)>4000 then
  raise exception 'verification_references_required' using errcode='22023';
 end if;
 if p_license_expires_at is not null and p_license_expires_at<current_date then
  raise exception 'license_expired' using errcode='22023';
 end if;
 if not exists(select 1 from public.therapist_private_verification v where v.therapist_id=p_therapist_id and nullif(btrim(v.document_path),'') is not null) then
  raise exception 'license_document_required' using errcode='22023';
 end if;
 if cardinality(v_countries)=0 or exists(select 1 from unnest(v_countries) c where c !~ '^[A-Z]{2}$') then
  raise exception 'approved_jurisdictions_required_as_iso_country_codes' using errcode='22023';
 end if;
 if p_years_experience is not null and p_years_experience not between 0 and 60 then
  raise exception 'invalid_years_experience' using errcode='22023';
 end if;

 select nullif(btrim(v.issuing_authority),'') into v_issuing_authority
 from public.therapist_private_verification v where v.therapist_id=p_therapist_id;
 if v_issuing_authority is null then
  raise exception 'jurisdiction_specific_issuing_authority_required' using errcode='22023';
 end if;

 insert into public.therapist_private_verification(
  therapist_id,license_number,issuing_authority,verified_by,updated_at,
  registry_checked_at,registry_reference,psychotherapy_scope_verified_at,
  psychotherapy_scope_evidence_reference,jurisdiction_reviewed_at,
  jurisdiction_review_reference,license_expires_at,approved_jurisdictions
 ) values(
  p_therapist_id,btrim(p_license_number),v_issuing_authority,v_admin,now(),
  now(),btrim(p_registry_reference),now(),btrim(p_psychotherapy_scope_evidence_reference),
  now(),btrim(p_jurisdiction_review_reference),p_license_expires_at,v_countries
 )
 on conflict(therapist_id) do update set
  license_number=excluded.license_number,issuing_authority=excluded.issuing_authority,
  verified_by=excluded.verified_by,updated_at=now(),registry_checked_at=now(),
  registry_reference=excluded.registry_reference,psychotherapy_scope_verified_at=now(),
  psychotherapy_scope_evidence_reference=excluded.psychotherapy_scope_evidence_reference,
  jurisdiction_reviewed_at=now(),jurisdiction_review_reference=excluded.jurisdiction_review_reference,
  license_expires_at=excluded.license_expires_at,approved_jurisdictions=excluded.approved_jurisdictions;

 update public.therapists set verified_at=now(),is_listed=coalesce(p_publish,false),
  practice_jurisdictions=v_countries,
  accepting_new_clients=coalesce(p_accepting_new_clients,false) and coalesce(p_publish,false),
  years_experience=p_years_experience,updated_at=now()
 where id=p_therapist_id;
end;
$function$;

revoke all on function public.admin_verify_therapist(uuid,text,date,text,text,text,text[],integer,boolean,boolean) from public,anon;
grant execute on function public.admin_verify_therapist(uuid,text,date,text,text,text,text[],integer,boolean,boolean) to authenticated;
