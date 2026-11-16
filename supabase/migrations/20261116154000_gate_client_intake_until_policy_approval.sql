-- Keep client intake closed until the final legal policy is approved and configured.
insert into public.site_settings(key,value)
values
  ('client_intake_enabled','false'::jsonb),
  ('client_policy_version','"2026-11-16-v1-draft"'::jsonb)
on conflict (key) do nothing;

create or replace function public.get_public_site_settings()
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  select jsonb_build_object(
    'tariffs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'market',t.market,'currency',t.currency,'amount',t.amount,
        'session_duration_minutes',t.session_duration_minutes,
        'therapist_percent',t.therapist_percent,'platform_percent',t.platform_percent,
        'effective_from',t.effective_from
      ) order by t.market,t.currency)
      from public.yad_tariff_history t
      where t.is_current and t.effective_from <= now()
    ), '[]'::jsonb),
    'contacts', coalesce((
      select to_jsonb(c) - 'id' - 'updated_by'
      from public.yad_public_contacts c where c.id=true
    ), '{}'::jsonb),
    'client_intake_enabled', coalesce((
      select (s.value #>> '{}')::boolean
      from public.site_settings s where s.key='client_intake_enabled'
    ), false),
    'client_policy_version', coalesce((
      select s.value #>> '{}'
      from public.site_settings s where s.key='client_policy_version'
    ), '2026-11-16-v1-draft')
  );
$function$;

create or replace function public.admin_set_client_intake(
  p_enabled boolean,
  p_policy_version text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_admin uuid := auth.uid();
  v_version text := trim(coalesce(p_policy_version,''));
begin
  perform public.require_admin_aal2();
  if p_enabled is null then
    raise exception 'intake_state_required' using errcode='22023';
  end if;
  if p_enabled and (
    length(v_version)<5 or length(v_version)>80
    or v_version ilike '%draft%' or v_version ilike '%test%'
    or v_version ilike '%preview%'
  ) then
    raise exception 'approved_policy_version_required' using errcode='22023';
  end if;
  insert into public.site_settings(key,value,updated_by,updated_at)
  values
    ('client_intake_enabled',to_jsonb(p_enabled),v_admin,now()),
    ('client_policy_version',to_jsonb(v_version),v_admin,now())
  on conflict(key) do update set
    value=excluded.value,updated_by=excluded.updated_by,updated_at=now();
  return true;
end;
$function$;

revoke all on function public.admin_set_client_intake(boolean,text) from public,anon;
grant execute on function public.admin_set_client_intake(boolean,text) to authenticated;

create or replace function public.create_client_request_with_consent(
  p_therapist_id uuid,
  p_market text,
  p_currency text,
  p_client_message text,
  p_policy_version text,
  p_adult_confirmation boolean,
  p_country_code text,
  p_timezone text,
  p_preferred_slot_id uuid default null
)
returns table(request_id uuid,payment_id uuid,amount bigint,currency text)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_client uuid:=auth.uid();
  v_country text:=upper(trim(coalesce(p_country_code,'')));
  v_timezone text:=trim(coalesce(p_timezone,''));
  v_consent uuid;
  v_request uuid;
  v_payment uuid;
  v_amount bigint;
  v_currency text;
  v_intake_enabled boolean;
  v_required_policy text;
begin
  if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;

  select coalesce((s.value #>> '{}')::boolean,false) into v_intake_enabled
  from public.site_settings s where s.key='client_intake_enabled';
  if coalesce(v_intake_enabled,false) is not true then
    raise exception 'client_intake_paused' using errcode='55000';
  end if;

  select coalesce(s.value #>> '{}','') into v_required_policy
  from public.site_settings s where s.key='client_policy_version';
  if v_required_policy='' or p_policy_version is distinct from v_required_policy
     or v_required_policy ilike '%draft%' or v_required_policy ilike '%test%' then
    raise exception 'current_policy_version_required' using errcode='22023';
  end if;
  if p_adult_confirmation is distinct from true then raise exception 'adult_confirmation_required' using errcode='22023'; end if;
  if v_country !~ '^[A-Z]{2}$' then raise exception 'valid_session_country_required' using errcode='22023'; end if;
  if v_timezone='' or length(v_timezone)>80 or not exists(select 1 from pg_timezone_names z where z.name=v_timezone) then
    raise exception 'valid_timezone_required' using errcode='22023';
  end if;
  if not exists(select 1 from public.therapists t where t.id=p_therapist_id and t.is_listed
    and t.verified_at is not null and t.accepting_new_clients is true and v_country=any(t.practice_jurisdictions)) then
    raise exception 'therapist_not_authorized_for_client_location' using errcode='42501';
  end if;
  if p_preferred_slot_id is not null and not exists(
    select 1 from public.availability_slots s where s.id=p_preferred_slot_id and s.therapist_id=p_therapist_id
      and s.is_available and s.starts_at>now()
  ) then raise exception 'slot_unavailable' using errcode='P0001'; end if;

  insert into public.client_policy_consents(client_id,policy_version,adult_confirmation,country_code,timezone,market,currency)
  values(v_client,v_required_policy,true,v_country,v_timezone,p_market,p_currency) returning id into v_consent;
  select r.request_id,r.payment_id,r.amount,r.currency into v_request,v_payment,v_amount,v_currency
  from public.create_client_request(p_therapist_id,p_market,p_currency,p_client_message) r;
  update public.client_requests set requested_slot_id=p_preferred_slot_id where id=v_request;
  update public.client_policy_consents set request_id=v_request where id=v_consent;
  return query select v_request,v_payment,v_amount,v_currency;
end;
$function$;

revoke all on function public.create_client_request_with_consent(uuid,text,text,text,text,boolean,text,text,uuid) from public,anon;
grant execute on function public.create_client_request_with_consent(uuid,text,text,text,text,boolean,text,text,uuid) to authenticated;
