-- YAD Center: therapist-specific first/follow-up session settings.
-- Additive migration: legacy therapist_fees and historical requests are preserved.
begin;

alter table public.therapists
  add column if not exists first_session_duration_minutes integer,
  add column if not exists followup_session_duration_minutes integer;

update public.therapists
set first_session_duration_minutes = coalesce(first_session_duration_minutes, session_duration_minutes, 45),
    followup_session_duration_minutes = coalesce(followup_session_duration_minutes, session_duration_minutes, 45);

update public.therapists
set first_session_duration_minutes = 75,
    followup_session_duration_minutes = 60,
    session_duration_minutes = 60
where public_slug = 'niko-ghasemi';

alter table public.therapists
  alter column first_session_duration_minutes set default 45,
  alter column followup_session_duration_minutes set default 45,
  alter column first_session_duration_minutes set not null,
  alter column followup_session_duration_minutes set not null;

alter table public.therapists
  drop constraint if exists therapists_first_session_duration_minutes_check,
  drop constraint if exists therapists_followup_session_duration_minutes_check;
alter table public.therapists
  add constraint therapists_first_session_duration_minutes_check
    check (first_session_duration_minutes between 20 and 180),
  add constraint therapists_followup_session_duration_minutes_check
    check (followup_session_duration_minutes between 20 and 180);

-- Keep the legacy table, constraints, RPCs and existing amounts intact.
create table if not exists public.therapist_session_fees (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  session_type text not null check (session_type in ('first','followup')),
  currency text not null check (currency in ('IRR','EUR','USD','CAD')),
  amount bigint not null check (amount > 0),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (therapist_id, session_type, currency)
);

-- Seed both types from each therapist's existing tariff without deleting or changing it.
insert into public.therapist_session_fees(therapist_id,session_type,currency,amount,updated_by,updated_at)
select f.therapist_id, s.session_type, f.currency, f.amount, f.updated_by, coalesce(f.updated_at,now())
from public.therapist_fees f
cross join (values ('first'::text),('followup'::text)) s(session_type)
on conflict (therapist_id,session_type,currency) do nothing;

alter table public.therapist_session_fees enable row level security;

create or replace function public.therapist_get_my_session_settings()
returns table(first_session_duration_minutes integer, followup_session_duration_minutes integer)
language plpgsql stable security definer set search_path=''
as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='therapist') then
    raise exception 'therapist_only' using errcode='42501';
  end if;
  return query
  select t.first_session_duration_minutes,t.followup_session_duration_minutes
  from public.therapists t where t.owner_user_id=auth.uid()
  order by t.updated_at desc limit 1;
end;
$$;

create or replace function public.therapist_set_my_session_durations(p_first_minutes integer,p_followup_minutes integer)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_therapist uuid;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='therapist') then
    raise exception 'therapist_only' using errcode='42501';
  end if;
  if p_first_minutes is null or p_followup_minutes is null or p_first_minutes not between 20 and 180 or p_followup_minutes not between 20 and 180 then
    raise exception 'invalid_session_duration' using errcode='22023';
  end if;
  select t.id into v_therapist from public.therapists t
  where t.owner_user_id=auth.uid() order by t.updated_at desc limit 1;
  if v_therapist is null then raise exception 'therapist_profile_not_linked' using errcode='P0002'; end if;
  update public.therapists set first_session_duration_minutes=p_first_minutes,
    followup_session_duration_minutes=p_followup_minutes,
    session_duration_minutes=p_followup_minutes, updated_at=now()
  where id=v_therapist;
  return true;
end;
$$;

create or replace function public.therapist_get_my_session_fees()
returns table(session_type text,currency text,amount bigint)
language plpgsql stable security definer set search_path=''
as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='therapist') then
    raise exception 'therapist_only' using errcode='42501';
  end if;
  return query
  select f.session_type,f.currency,f.amount
  from public.therapist_session_fees f
  join public.therapists t on t.id=f.therapist_id
  where t.owner_user_id=auth.uid();
end;
$$;

create or replace function public.therapist_set_my_session_fee(p_session_type text,p_currency text,p_amount bigint)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_therapist uuid;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='therapist') then
    raise exception 'therapist_only' using errcode='42501';
  end if;
  if p_session_type not in ('first','followup') or p_currency not in ('IRR','EUR','USD','CAD')
     or p_amount is null or p_amount<=0 then
    raise exception 'invalid_fee' using errcode='22023';
  end if;
  select t.id into v_therapist from public.therapists t
  where t.owner_user_id=auth.uid() order by t.updated_at desc limit 1;
  if v_therapist is null then raise exception 'therapist_profile_not_linked' using errcode='P0002'; end if;
  insert into public.therapist_session_fees(therapist_id,session_type,currency,amount,updated_by,updated_at)
  values(v_therapist,p_session_type,p_currency,p_amount,auth.uid(),now())
  on conflict(therapist_id,session_type,currency) do update
  set amount=excluded.amount,updated_by=auth.uid(),updated_at=now();
  return true;
end;
$$;

create or replace function public.client_get_therapist_session_quote(p_therapist_id uuid,p_market text,p_currency text)
returns table(session_type text,is_first_session boolean,session_duration_minutes integer,amount bigint,currency text)
language plpgsql stable security definer set search_path=''
as $$
declare v_client uuid:=auth.uid(); v_type text; v_duration integer;
begin
  if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  if p_market not in ('iran','international')
    or (p_market='iran' and p_currency<>'IRR')
    or (p_market='international' and p_currency not in ('EUR','USD','CAD')) then
    raise exception 'invalid_market_or_currency' using errcode='22023';
  end if;
  select case when exists(
    select 1 from public.appointments a
    where a.client_id=v_client and a.therapist_id=p_therapist_id
      and (a.status='completed' or (a.status='confirmed' and a.ends_at<now()))
  ) then 'followup' else 'first' end into v_type;
  select case when v_type='first' then t.first_session_duration_minutes
              else t.followup_session_duration_minutes end
  into v_duration from public.therapists t
  where t.id=p_therapist_id and t.is_listed and t.manager_approved and t.accepting_new_clients;
  if v_duration is null then raise exception 'therapist_not_available' using errcode='P0001'; end if;
  return query
  select f.session_type,(v_type='first'),v_duration,f.amount,f.currency
  from public.therapist_session_fees f
  where f.therapist_id=p_therapist_id and f.session_type=v_type and f.currency=p_currency;
end;
$$;

create or replace function public.get_public_therapist_session_fees(p_therapist_id uuid)
returns table(session_type text,currency text,amount bigint,session_duration_minutes integer)
language sql stable security definer set search_path=''
as $$
  select f.session_type,f.currency,f.amount,
    case when f.session_type='first' then t.first_session_duration_minutes
         else t.followup_session_duration_minutes end
  from public.therapist_session_fees f
  join public.therapists t on t.id=f.therapist_id
  where f.therapist_id=p_therapist_id and t.is_listed
  order by case f.session_type when 'first' then 1 else 2 end,
    case f.currency when 'IRR' then 1 when 'EUR' then 2 when 'USD' then 3 else 4 end;
$$;

create or replace function public.get_public_therapist_session_fee_directory()
returns table(therapist_id uuid,session_type text,currency text,amount bigint,session_duration_minutes integer)
language sql stable security definer set search_path=''
as $$
  select f.therapist_id,f.session_type,f.currency,f.amount,
    case when f.session_type='first' then t.first_session_duration_minutes
         else t.followup_session_duration_minutes end
  from public.therapist_session_fees f
  join public.therapists t on t.id=f.therapist_id
  where t.is_listed and (t.verified_at is not null or t.manager_approved)
  order by f.therapist_id,f.session_type,f.currency;
$$;

-- Keep the existing create_client_request signature and all its prior validations.
create or replace function public.create_client_request(p_therapist_id uuid,p_market text,p_currency text,p_client_message text default null)
returns table(request_id uuid,payment_id uuid,amount bigint,currency text)
language plpgsql security definer set search_path=''
as $$
declare
  v_client uuid:=auth.uid();
  v_fee public.therapist_session_fees%rowtype;
  v_request uuid; v_payment uuid; v_share bigint;
  v_type text; v_duration integer;
begin
  if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  if p_market not in ('iran','international')
    or (p_market='iran' and p_currency<>'IRR')
    or (p_market='international' and p_currency not in ('EUR','USD','CAD')) then
    raise exception 'invalid_market_or_currency' using errcode='22023';
  end if;
  if p_client_message is not null and length(p_client_message)>500 then
    raise exception 'message_too_long' using errcode='22023';
  end if;
  if not exists(select 1 from public.therapists t
    where t.id=p_therapist_id and t.is_listed and t.manager_approved and t.accepting_new_clients) then
    raise exception 'therapist_not_available' using errcode='P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_client::text||':'||p_therapist_id::text,0));
  select case when exists(select 1 from public.appointments a
    where a.client_id=v_client and a.therapist_id=p_therapist_id and (a.status='completed' or (a.status='confirmed' and a.ends_at<now())))
    then 'followup' else 'first' end into v_type;
  select case when v_type='first' then t.first_session_duration_minutes
              else t.followup_session_duration_minutes end
    into v_duration from public.therapists t where t.id=p_therapist_id;
  select * into v_fee from public.therapist_session_fees f
    where f.therapist_id=p_therapist_id and f.session_type=v_type and f.currency=p_currency;
  if not found then raise exception 'therapist_fee_not_configured_for_currency' using errcode='P0001'; end if;

  v_share:=floor(v_fee.amount*0.70)::bigint;
  insert into public.client_requests(
    client_id,therapist_id,market,currency,amount,therapist_share_amount,platform_share_amount,
    client_message,tariff_id,therapist_percent,platform_percent,session_duration_minutes
  ) values(
    v_client,p_therapist_id,p_market,p_currency,v_fee.amount,v_share,v_fee.amount-v_share,
    nullif(trim(p_client_message),''),null,70,30,v_duration
  ) returning id into v_request;
  insert into public.payments(appointment_id,request_id,client_id,amount,currency,status,provider,provider_market)
  values(null,v_request,v_client,v_fee.amount,p_currency,'pending','manual_transfer',p_market)
  returning id into v_payment;
  return query select v_request,v_payment,v_fee.amount,p_currency;
end;
$$;

-- Existing 2-argument slot RPC remains intact for older clients. New clients request a duration.
create or replace function public.client_list_available_slots(p_therapist_id uuid,p_country_code text,p_session_duration_minutes integer)
returns table(slot_id uuid,starts_at timestamptz,ends_at timestamptz,timezone text)
language plpgsql stable security definer set search_path=''
as $$
declare v_client uuid:=auth.uid(); v_country text:=upper(trim(coalesce(p_country_code,'')));
begin
  if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  if v_country !~ '^[A-Z]{2}$' then raise exception 'valid_session_country_required' using errcode='22023'; end if;
  if p_session_duration_minutes not between 20 and 180 then raise exception 'invalid_session_duration' using errcode='22023'; end if;
  return query
  select s.id,s.starts_at,s.ends_at,s.timezone
  from public.availability_slots s join public.therapists t on t.id=s.therapist_id
  where s.therapist_id=p_therapist_id and s.is_available and s.starts_at>now()
    and s.ends_at-s.starts_at>=make_interval(mins=>p_session_duration_minutes)
    and t.is_listed and t.manager_approved and t.accepting_new_clients
    and not exists(select 1 from public.appointments a
      where a.therapist_id=s.therapist_id and a.status in ('requested','confirmed')
      and a.starts_at<s.ends_at and a.ends_at>s.starts_at)
  order by s.starts_at limit 80;
end;
$$;

create or replace function public.therapist_create_availability_slot(p_starts_at timestamptz,p_ends_at timestamptz,p_timezone text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_therapist uuid; v_id uuid; v_zone text:=trim(coalesce(p_timezone,''));
begin
  if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.role='therapist') then
    raise exception 'therapist_only' using errcode='42501';
  end if;
  select t.id into v_therapist from public.therapists t
  where t.owner_user_id=v_user and t.verified_at is not null and t.is_listed and t.accepting_new_clients;
  if v_therapist is null then raise exception 'verified_accepting_therapist_required' using errcode='42501'; end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at<=now()
    or p_ends_at<=p_starts_at or p_ends_at-p_starts_at<interval '20 minutes'
    or p_ends_at-p_starts_at>interval '180 minutes' then
    raise exception 'valid_future_availability_window_required' using errcode='22023';
  end if;
  if v_zone='' or length(v_zone)>80 or not exists(select 1 from pg_timezone_names z where z.name=v_zone) then
    raise exception 'valid_timezone_required' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_therapist::text,0));
  if exists(select 1 from public.availability_slots s where s.therapist_id=v_therapist
    and s.starts_at<p_ends_at and s.ends_at>p_starts_at) then
    raise exception 'availability_overlap' using errcode='23P01';
  end if;
  insert into public.availability_slots(therapist_id,starts_at,ends_at,is_available,timezone)
  values(v_therapist,p_starts_at,p_ends_at,true,v_zone) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_schedule_request_from_slot(p_request_id uuid,p_slot_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_admin uuid:=auth.uid(); v_request public.client_requests%rowtype;
  v_slot public.availability_slots%rowtype; v_appointment uuid; v_client_timezone text; v_end timestamptz;
begin
  perform public.require_admin_aal2();
  if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
    raise exception 'admin_only' using errcode='42501';
  end if;
  select * into v_request from public.client_requests r where r.id=p_request_id and r.status='payment_verified' for update;
  if not found then raise exception 'request_not_ready_to_schedule' using errcode='P0001'; end if;
  if not exists(select 1 from public.payments p where p.request_id=p_request_id and p.status='paid') then
    raise exception 'payment_not_verified' using errcode='P0001';
  end if;
  select * into v_slot from public.availability_slots s
  where s.id=p_slot_id and s.therapist_id=v_request.therapist_id and s.is_available=true and s.starts_at>now()
  for update;
  if not found then raise exception 'slot_unavailable' using errcode='P0001'; end if;
  if v_request.session_duration_minutes not between 20 and 180
     or v_slot.ends_at-v_slot.starts_at<make_interval(mins=>v_request.session_duration_minutes) then
    raise exception 'slot_too_short_for_session' using errcode='P0001';
  end if;
  v_end:=v_slot.starts_at+make_interval(mins=>v_request.session_duration_minutes);
  if not exists(select 1 from public.therapists t where t.id=v_request.therapist_id and t.is_listed and t.verified_at is not null) then
    raise exception 'therapist_no_longer_available' using errcode='P0001';
  end if;
  if exists(select 1 from public.appointments a where a.therapist_id=v_slot.therapist_id
    and a.status in ('requested','confirmed') and a.starts_at<v_end and a.ends_at>v_slot.starts_at) then
    raise exception 'slot_conflict' using errcode='P0001';
  end if;
  select coalesce(nullif(p.timezone,''),v_slot.timezone,'Asia/Tehran') into v_client_timezone
  from public.profiles p where p.id=v_request.client_id;
  insert into public.appointments(client_id,therapist_id,slot_id,starts_at,ends_at,status,client_message,market,timezone)
  values(v_request.client_id,v_request.therapist_id,v_slot.id,v_slot.starts_at,v_end,
    'confirmed',v_request.client_message,v_request.market,coalesce(v_client_timezone,'Asia/Tehran'))
  returning id into v_appointment;
  update public.availability_slots set is_available=false where id=v_slot.id;
  update public.client_requests set status='scheduled',appointment_id=v_appointment,updated_at=now() where id=p_request_id;
  update public.payments set appointment_id=v_appointment where request_id=p_request_id and status='paid';
  return v_appointment;
end;
$$;

revoke all on function public.therapist_get_my_session_settings() from public, anon;
revoke all on function public.therapist_set_my_session_durations(integer,integer) from public, anon;
revoke all on function public.therapist_get_my_session_fees() from public, anon;
revoke all on function public.therapist_set_my_session_fee(text,text,bigint) from public, anon;
revoke all on function public.client_get_therapist_session_quote(uuid,text,text) from public, anon;
revoke all on function public.get_public_therapist_session_fees(uuid) from public;
revoke all on function public.get_public_therapist_session_fee_directory() from public;
revoke all on function public.client_list_available_slots(uuid,text,integer) from public, anon;

grant execute on function public.therapist_get_my_session_settings() to authenticated;
grant execute on function public.therapist_set_my_session_durations(integer,integer) to authenticated;
grant execute on function public.therapist_get_my_session_fees() to authenticated;
grant execute on function public.therapist_set_my_session_fee(text,text,bigint) to authenticated;
grant execute on function public.client_get_therapist_session_quote(uuid,text,text) to authenticated;
grant execute on function public.get_public_therapist_session_fees(uuid) to anon,authenticated;
grant execute on function public.get_public_therapist_session_fee_directory() to anon,authenticated;
grant execute on function public.client_list_available_slots(uuid,text,integer) to authenticated;

commit;
