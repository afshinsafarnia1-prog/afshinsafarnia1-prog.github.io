
create or replace function public.enforce_therapist_verification_evidence()
returns trigger
language plpgsql
security invoker
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

revoke all on function public.enforce_therapist_verification_evidence() from public, anon, authenticated;
