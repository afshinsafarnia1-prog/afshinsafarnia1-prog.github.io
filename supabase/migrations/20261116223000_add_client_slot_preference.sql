-- Let clients express a preferred available slot; final allocation remains admin-controlled
-- after manual payment verification. The existing 8-argument consent RPC remains available
-- for compatibility; the 9-argument overload records the optional preferred slot.
alter table public.client_requests
  add column if not exists requested_slot_id uuid references public.availability_slots(id) on delete set null;
create index if not exists client_requests_requested_slot_idx
  on public.client_requests(requested_slot_id) where requested_slot_id is not null;

create or replace function public.client_list_available_slots(p_therapist_id uuid,p_country_code text)
returns table(slot_id uuid,starts_at timestamptz,ends_at timestamptz,timezone text)
language plpgsql stable security definer set search_path=''
as $function$
declare v_client uuid:=auth.uid(); v_country text:=upper(trim(coalesce(p_country_code,'')));
begin
  if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  if v_country !~ '^[A-Z]{2}$' then raise exception 'valid_session_country_required' using errcode='22023'; end if;
  return query
  select s.id,s.starts_at,s.ends_at,s.timezone
  from public.availability_slots s join public.therapists t on t.id=s.therapist_id
  where s.therapist_id=p_therapist_id and s.is_available and s.starts_at>now()
    and t.is_listed and t.verified_at is not null and t.accepting_new_clients
    and v_country=any(t.practice_jurisdictions)
    and not exists(select 1 from public.appointments a where a.therapist_id=s.therapist_id
      and a.status in ('requested','confirmed') and a.starts_at<s.ends_at and a.ends_at>s.starts_at)
  order by s.starts_at limit 80;
end;
$function$;

create or replace function public.create_client_request_with_consent(
  p_therapist_id uuid,p_market text,p_currency text,p_client_message text default null,
  p_policy_version text,p_adult_confirmation boolean,p_country_code text,p_timezone text,
  p_preferred_slot_id uuid
)
returns table(request_id uuid,payment_id uuid,amount bigint,currency text)
language plpgsql security definer set search_path=''
as $function$
declare
  v_client uuid:=auth.uid(); v_country text:=upper(trim(coalesce(p_country_code,'')));
  v_timezone text:=trim(coalesce(p_timezone,'')); v_consent uuid;
  v_request uuid; v_payment uuid; v_amount bigint; v_currency text;
  v_intake_enabled boolean; v_required_policy text;
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
     or v_required_policy ilike '%draft%' or v_required_policy ilike '%test%' or v_required_policy ilike '%preview%' then
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
    select 1 from public.availability_slots s where s.id=p_preferred_slot_id
      and s.therapist_id=p_therapist_id and s.is_available and s.starts_at>now()
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

revoke all on function public.client_list_available_slots(uuid,text) from public,anon;
revoke all on function public.create_client_request_with_consent(uuid,text,text,text,text,boolean,text,text,uuid) from public,anon;
grant execute on function public.client_list_available_slots(uuid,text) to authenticated;
grant execute on function public.create_client_request_with_consent(uuid,text,text,text,text,boolean,text,text,uuid) to authenticated;

create or replace function public.admin_list_available_slots_for_request(p_request_id uuid)
returns table(slot_id uuid,starts_at timestamptz,ends_at timestamptz,timezone text,client_timezone text)
language plpgsql stable security definer set search_path=''
as $function$
declare v_request public.client_requests%rowtype;
begin
  perform public.require_admin_aal2();
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then
    raise exception 'admin_only' using errcode='42501';
  end if;
  select * into v_request from public.client_requests r where r.id=p_request_id and r.status='payment_verified';
  if not found then raise exception 'request_not_ready_to_schedule' using errcode='P0001'; end if;
  if not exists(select 1 from public.payments p where p.request_id=p_request_id and p.status='paid') then
    raise exception 'payment_not_verified' using errcode='P0001';
  end if;
  return query
  select s.id,s.starts_at,s.ends_at,s.timezone,coalesce(nullif(p.timezone,''),s.timezone,'Asia/Tehran')
  from public.availability_slots s join public.profiles p on p.id=v_request.client_id
  join public.therapists t on t.id=s.therapist_id
  where s.therapist_id=v_request.therapist_id and s.is_available=true and s.starts_at>now()
    and t.is_listed and t.verified_at is not null
    and not exists(select 1 from public.appointments a where a.therapist_id=s.therapist_id
      and a.status in ('requested','confirmed') and a.starts_at<s.ends_at and a.ends_at>s.starts_at)
  order by case when s.id=v_request.requested_slot_id then 0 else 1 end,s.starts_at;
end;
$function$;
revoke all on function public.admin_list_available_slots_for_request(uuid) from public,anon;
grant execute on function public.admin_list_available_slots_for_request(uuid) to authenticated;
