-- Duration-only change for Niko Ghasemi.
-- Existing therapist_fees, amounts, percentages, client requests and appointments are not rewritten.
begin;

create or replace function public.client_get_therapist_session_duration(p_therapist_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_client uuid := auth.uid();
  v_slug text;
  v_duration integer;
  v_is_followup boolean;
begin
  if v_client is null or not exists (
    select 1 from public.profiles p where p.id = v_client and p.role = 'client'
  ) then
    raise exception 'client_only' using errcode = '42501';
  end if;

  select t.public_slug into v_slug
  from public.therapists t
  where t.id = p_therapist_id
    and t.is_listed
    and t.manager_approved
    and t.accepting_new_clients;

  if not found then
    raise exception 'therapist_not_available' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.appointments a
    where a.client_id = v_client
      and a.therapist_id = p_therapist_id
      and (
        a.status = 'completed'
        or (a.status = 'confirmed' and a.ends_at < now())
      )
  ) into v_is_followup;

  if v_slug = 'niko-ghasemi' then
    return case when v_is_followup then 60 else 75 end;
  end if;

  select min(f.session_duration_minutes)::integer into v_duration
  from public.therapist_fees f
  where f.therapist_id = p_therapist_id;

  return coalesce(v_duration, 45);
end;
$function$;

create or replace function public.get_public_therapist_session_durations(p_therapist_id uuid)
returns table(first_session_duration_minutes integer, followup_session_duration_minutes integer)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    case when t.public_slug = 'niko-ghasemi' then 75 else coalesce(min(f.session_duration_minutes)::integer, 45) end,
    case when t.public_slug = 'niko-ghasemi' then 60 else coalesce(min(f.session_duration_minutes)::integer, 45) end
  from public.therapists t
  left join public.therapist_fees f on f.therapist_id = t.id
  where t.id = p_therapist_id and t.is_listed
  group by t.id, t.public_slug;
$function$;

-- Preserve the original fee lookup and 70/30 calculation; only the stored session length differs for Niko.
create or replace function public.create_client_request(
  p_therapist_id uuid,
  p_market text,
  p_currency text,
  p_client_message text default null
)
returns table(request_id uuid, payment_id uuid, amount bigint, currency text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_client uuid := auth.uid();
  v_fee public.therapist_fees%rowtype;
  v_request uuid;
  v_payment uuid;
  v_share bigint;
  v_duration integer;
  v_slug text;
  v_is_followup boolean;
begin
  if v_client is null or not exists (
    select 1 from public.profiles p where p.id = v_client and p.role = 'client'
  ) then
    raise exception 'client_only' using errcode = '42501';
  end if;

  if p_market not in ('iran','international')
    or (p_market = 'iran' and p_currency <> 'IRR')
    or (p_market = 'international' and p_currency not in ('EUR','USD','CAD')) then
    raise exception 'invalid_market_or_currency' using errcode = '22023';
  end if;

  if p_client_message is not null and length(p_client_message) > 500 then
    raise exception 'message_too_long' using errcode = '22023';
  end if;

  select t.public_slug into v_slug
  from public.therapists t
  where t.id = p_therapist_id
    and t.is_listed
    and t.manager_approved
    and t.accepting_new_clients;

  if not found then
    raise exception 'therapist_not_available' using errcode = 'P0001';
  end if;

  select * into v_fee
  from public.therapist_fees f
  where f.therapist_id = p_therapist_id
    and f.currency = p_currency;

  if not found then
    raise exception 'therapist_fee_not_configured_for_currency' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_client::text || ':' || p_therapist_id::text, 0));

  select exists (
    select 1 from public.appointments a
    where a.client_id = v_client
      and a.therapist_id = p_therapist_id
      and (
        a.status = 'completed'
        or (a.status = 'confirmed' and a.ends_at < now())
      )
  ) into v_is_followup;

  v_duration := case
    when v_slug = 'niko-ghasemi' and v_is_followup then 60
    when v_slug = 'niko-ghasemi' then 75
    else coalesce(v_fee.session_duration_minutes, 45)
  end;

  v_share := floor(v_fee.amount * 0.70)::bigint;

  insert into public.client_requests(
    client_id, therapist_id, market, currency, amount,
    therapist_share_amount, platform_share_amount, client_message,
    tariff_id, therapist_percent, platform_percent, session_duration_minutes
  ) values (
    v_client, p_therapist_id, p_market, p_currency, v_fee.amount,
    v_share, v_fee.amount - v_share, nullif(trim(p_client_message), ''),
    null, 70, 30, v_duration
  ) returning id into v_request;

  insert into public.payments(
    appointment_id, request_id, client_id, amount, currency,
    status, provider, provider_market
  ) values (
    null, v_request, v_client, v_fee.amount, p_currency,
    'pending', 'manual_transfer', p_market
  ) returning id into v_payment;

  return query select v_request, v_payment, v_fee.amount, p_currency;
end;
$function$;

-- New overload; the existing two-argument RPC remains available to older clients.
create or replace function public.client_list_available_slots(
  p_therapist_id uuid,
  p_country_code text,
  p_session_duration_minutes integer
)
returns table(slot_id uuid, starts_at timestamptz, ends_at timestamptz, timezone text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_client uuid := auth.uid();
  v_country text := upper(trim(coalesce(p_country_code, '')));
begin
  if v_client is null or not exists (
    select 1 from public.profiles p where p.id = v_client and p.role = 'client'
  ) then
    raise exception 'client_only' using errcode = '42501';
  end if;

  if v_country !~ '^[A-Z]{2}$' then
    raise exception 'valid_session_country_required' using errcode = '22023';
  end if;

  if p_session_duration_minutes not between 20 and 180 then
    raise exception 'invalid_session_duration' using errcode = '22023';
  end if;

  return query
  select s.id, s.starts_at, s.ends_at, s.timezone
  from public.availability_slots s
  join public.therapists t on t.id = s.therapist_id
  where s.therapist_id = p_therapist_id
    and s.is_available
    and s.starts_at > now()
    and s.ends_at - s.starts_at >= make_interval(mins => p_session_duration_minutes)
    and t.is_listed
    and t.manager_approved
    and t.accepting_new_clients
    and not exists (
      select 1 from public.appointments a
      where a.therapist_id = s.therapist_id
        and a.status in ('requested','confirmed')
        and a.starts_at < s.ends_at
        and a.ends_at > s.starts_at
    )
  order by s.starts_at
  limit 80;
end;
$function$;

-- The appointment uses the requested duration, not the entire availability window.
create or replace function public.admin_schedule_request_from_slot(p_request_id uuid, p_slot_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := auth.uid();
  v_request public.client_requests%rowtype;
  v_slot public.availability_slots%rowtype;
  v_appointment uuid;
  v_client_timezone text;
  v_end timestamptz;
begin
  perform public.require_admin_aal2();

  if v_admin is null or not exists (
    select 1 from public.profiles p where p.id = v_admin and p.role = 'admin'
  ) then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  select * into v_request
  from public.client_requests r
  where r.id = p_request_id and r.status = 'payment_verified'
  for update;

  if not found then
    raise exception 'request_not_ready_to_schedule' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.payments p
    where p.request_id = p_request_id and p.status = 'paid'
  ) then
    raise exception 'payment_not_verified' using errcode = 'P0001';
  end if;

  select * into v_slot
  from public.availability_slots s
  where s.id = p_slot_id
    and s.therapist_id = v_request.therapist_id
    and s.is_available = true
    and s.starts_at > now()
  for update;

  if not found then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  if v_request.session_duration_minutes not between 20 and 180
    or v_slot.ends_at - v_slot.starts_at < make_interval(mins => v_request.session_duration_minutes) then
    raise exception 'slot_too_short_for_session' using errcode = 'P0001';
  end if;

  v_end := v_slot.starts_at + make_interval(mins => v_request.session_duration_minutes);

  if not exists (
    select 1 from public.therapists t
    where t.id = v_request.therapist_id and t.is_listed and t.verified_at is not null
  ) then
    raise exception 'therapist_no_longer_available' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.appointments a
    where a.therapist_id = v_slot.therapist_id
      and a.status in ('requested','confirmed')
      and a.starts_at < v_end
      and a.ends_at > v_slot.starts_at
  ) then
    raise exception 'slot_conflict' using errcode = 'P0001';
  end if;

  select coalesce(nullif(p.timezone, ''), v_slot.timezone, 'Asia/Tehran')
  into v_client_timezone
  from public.profiles p
  where p.id = v_request.client_id;

  insert into public.appointments(
    client_id, therapist_id, slot_id, starts_at, ends_at,
    status, client_message, market, timezone
  ) values (
    v_request.client_id, v_request.therapist_id, v_slot.id,
    v_slot.starts_at, v_end, 'confirmed', v_request.client_message,
    v_request.market, coalesce(v_client_timezone, 'Asia/Tehran')
  ) returning id into v_appointment;

  update public.availability_slots set is_available = false where id = v_slot.id;
  update public.client_requests
  set status = 'scheduled', appointment_id = v_appointment, updated_at = now()
  where id = p_request_id;
  update public.payments
  set appointment_id = v_appointment
  where request_id = p_request_id and status = 'paid';

  return v_appointment;
end;
$function$;

-- Only show admin slots long enough for the requested session.
create or replace function public.admin_list_available_slots_for_request(p_request_id uuid)
returns table(slot_id uuid, starts_at timestamptz, ends_at timestamptz, timezone text, client_timezone text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_request public.client_requests%rowtype;
begin
  perform public.require_admin_aal2();

  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  select * into v_request
  from public.client_requests r
  where r.id = p_request_id and r.status = 'payment_verified';

  if not found then
    raise exception 'request_not_ready_to_schedule' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.payments p
    where p.request_id = p_request_id and p.status = 'paid'
  ) then
    raise exception 'payment_not_verified' using errcode = 'P0001';
  end if;

  return query
  select s.id, s.starts_at, s.ends_at, s.timezone,
    coalesce(nullif(p.timezone, ''), s.timezone, 'Asia/Tehran')
  from public.availability_slots s
  join public.profiles p on p.id = v_request.client_id
  join public.therapists t on t.id = s.therapist_id
  where s.therapist_id = v_request.therapist_id
    and s.is_available = true
    and s.starts_at > now()
    and s.ends_at - s.starts_at >= make_interval(mins => v_request.session_duration_minutes)
    and t.is_listed
    and t.verified_at is not null
    and not exists (
      select 1 from public.appointments a
      where a.therapist_id = s.therapist_id
        and a.status in ('requested','confirmed')
        and a.starts_at < s.ends_at
        and a.ends_at > s.starts_at
    )
  order by case when s.id = v_request.requested_slot_id then 0 else 1 end, s.starts_at;
end;
$function$;

-- Admin may create a longer availability window for Niko; other therapists retain 45-minute slots.
create or replace function public.admin_create_availability_slot(
  p_therapist_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := auth.uid();
  v_id uuid;
  v_zone text := trim(coalesce(p_timezone, ''));
  v_slug text;
begin
  perform public.require_admin_aal2();

  if v_admin is null or not exists (
    select 1 from public.profiles p where p.id = v_admin and p.role = 'admin'
  ) then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  select t.public_slug into v_slug
  from public.therapists t
  where t.id = p_therapist_id and t.verified_at is not null and t.is_listed;

  if not found then
    raise exception 'verified_listed_therapist_required' using errcode = '23514';
  end if;

  if p_starts_at is null or p_ends_at is null or p_starts_at <= now()
    or p_ends_at <= p_starts_at then
    raise exception 'valid_future_availability_window_required' using errcode = '22023';
  end if;

  if v_slug = 'niko-ghasemi' then
    if p_ends_at - p_starts_at < interval '75 minutes'
      or p_ends_at - p_starts_at > interval '180 minutes' then
      raise exception 'niko_availability_must_be_75_to_180_minutes' using errcode = '22023';
    end if;
  elsif p_ends_at - p_starts_at <> interval '45 minutes' then
    raise exception 'future_45_minute_slot_required' using errcode = '22023';
  end if;

  if v_zone = '' or length(v_zone) > 80
    or not exists(select 1 from pg_timezone_names z where z.name = v_zone) then
    raise exception 'valid_timezone_required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_therapist_id::text, 0));

  if exists (
    select 1 from public.availability_slots s
    where s.therapist_id = p_therapist_id
      and s.starts_at < p_ends_at
      and s.ends_at > p_starts_at
  ) then
    raise exception 'availability_overlap' using errcode = '23P01';
  end if;

  insert into public.availability_slots(therapist_id, starts_at, ends_at, is_available, timezone)
  values (p_therapist_id, p_starts_at, p_ends_at, true, v_zone)
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.client_get_therapist_session_duration(uuid) from public, anon;
revoke all on function public.get_public_therapist_session_durations(uuid) from public;
revoke all on function public.client_list_available_slots(uuid, text, integer) from public, anon;

grant execute on function public.client_get_therapist_session_duration(uuid) to authenticated;
grant execute on function public.get_public_therapist_session_durations(uuid) to anon, authenticated;
grant execute on function public.client_list_available_slots(uuid, text, integer) to authenticated;

commit;
