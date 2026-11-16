-- Per-therapist session fees. IRR values are stored in rial; the UI displays toman.
create table if not exists public.therapist_fees (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  currency text not null check (currency in ('IRR','EUR','USD','CAD')),
  amount bigint not null check (amount > 0),
  session_duration_minutes integer not null default 45 check (session_duration_minutes = 45),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (therapist_id,currency)
);
alter table public.therapist_fees enable row level security;
revoke all on public.therapist_fees from anon, authenticated;

alter table public.client_requests drop constraint if exists client_requests_check;
alter table public.client_requests drop constraint if exists client_requests_currency_check;
alter table public.client_requests add constraint client_requests_check check (
  (market='iran' and currency='IRR') or
  (market='international' and currency in ('EUR','USD','CAD'))
);
alter table public.payments drop constraint if exists payments_currency_check;
alter table public.payments add constraint payments_currency_check check (currency in ('IRR','EUR','USD','CAD'));

create or replace function public.admin_or_therapist_set_fee(p_therapist_id uuid,p_currency text,p_amount bigint)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_role text;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_currency not in ('IRR','EUR','USD','CAD') or p_amount is null or p_amount<=0 then raise exception 'invalid_fee' using errcode='22023'; end if;
  select p.role::text into v_role from public.profiles p where p.id=v_user;
  if v_role='admin' then perform public.require_admin_aal2();
  elsif v_role='therapist' then
    if not exists(select 1 from public.therapists t where t.id=p_therapist_id and t.owner_user_id=v_user) then raise exception 'therapist_profile_not_owned' using errcode='42501'; end if;
  else raise exception 'admin_or_profile_owner_only' using errcode='42501'; end if;
  insert into public.therapist_fees(therapist_id,currency,amount,updated_by,updated_at)
  values(p_therapist_id,p_currency,p_amount,v_user,now())
  on conflict(therapist_id,currency) do update set amount=excluded.amount,updated_by=excluded.updated_by,updated_at=now();
  return true;
end; $$;
revoke all on function public.admin_or_therapist_set_fee(uuid,text,bigint) from public,anon;
grant execute on function public.admin_or_therapist_set_fee(uuid,text,bigint) to authenticated;

create or replace function public.get_public_therapist_fees(p_therapist_id uuid)
returns table(currency text,amount bigint,session_duration_minutes integer)
language sql stable security definer set search_path=''
as $$
 select f.currency,f.amount,f.session_duration_minutes from public.therapist_fees f
 join public.therapists t on t.id=f.therapist_id
 where f.therapist_id=p_therapist_id and t.is_listed and t.verified_at is not null
 order by case f.currency when 'IRR' then 1 when 'EUR' then 2 when 'USD' then 3 else 4 end;
$$;
revoke all on function public.get_public_therapist_fees(uuid) from public;
grant execute on function public.get_public_therapist_fees(uuid) to anon,authenticated;

create or replace function public.get_public_therapist_fee_directory()
returns table(therapist_id uuid,currency text,amount bigint,session_duration_minutes integer)
language sql stable security definer set search_path=''
as $$
 select f.therapist_id,f.currency,f.amount,f.session_duration_minutes from public.therapist_fees f
 join public.therapists t on t.id=f.therapist_id where t.is_listed and t.verified_at is not null;
$$;
revoke all on function public.get_public_therapist_fee_directory() from public;
grant execute on function public.get_public_therapist_fee_directory() to anon,authenticated;

create or replace function public.therapist_get_my_fees()
returns table(currency text,amount bigint,session_duration_minutes integer)
language plpgsql stable security definer set search_path=''
as $$
begin
 return query select f.currency,f.amount,f.session_duration_minutes from public.therapist_fees f
 join public.therapists t on t.id=f.therapist_id
 where t.owner_user_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='therapist');
end; $$;
revoke all on function public.therapist_get_my_fees() from public,anon;
grant execute on function public.therapist_get_my_fees() to authenticated;

create or replace function public.admin_get_therapist_fees(p_therapist_id uuid)
returns table(currency text,amount bigint,session_duration_minutes integer)
language plpgsql stable security definer set search_path=''
as $$
begin
 perform public.require_admin_aal2();
 return query select f.currency,f.amount,f.session_duration_minutes from public.therapist_fees f where f.therapist_id=p_therapist_id;
end; $$;
revoke all on function public.admin_get_therapist_fees(uuid) from public,anon;
grant execute on function public.admin_get_therapist_fees(uuid) to authenticated;

create or replace function public.create_client_request(p_therapist_id uuid,p_market text,p_currency text,p_client_message text default null)
returns table(request_id uuid,payment_id uuid,amount bigint,currency text)
language plpgsql security definer set search_path=''
as $$
declare v_client uuid:=auth.uid(); v_fee public.therapist_fees%rowtype; v_request uuid; v_payment uuid; v_share bigint;
begin
 if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then raise exception 'client_only' using errcode='42501'; end if;
 if p_market not in ('iran','international') or (p_market='iran' and p_currency<>'IRR') or (p_market='international' and p_currency not in ('EUR','USD','CAD')) then raise exception 'invalid_market_or_currency' using errcode='22023'; end if;
 if p_client_message is not null and length(p_client_message)>500 then raise exception 'message_too_long' using errcode='22023'; end if;
 if not exists(select 1 from public.therapists t where t.id=p_therapist_id and t.is_listed and t.verified_at is not null and t.accepting_new_clients) then raise exception 'therapist_not_available' using errcode='P0001'; end if;
 select * into v_fee from public.therapist_fees f where f.therapist_id=p_therapist_id and f.currency=p_currency;
 if not found then raise exception 'therapist_fee_not_configured_for_currency' using errcode='P0001'; end if;
 v_share:=floor(v_fee.amount*0.70)::bigint;
 insert into public.client_requests(client_id,therapist_id,market,currency,amount,therapist_share_amount,platform_share_amount,client_message,tariff_id,therapist_percent,platform_percent,session_duration_minutes)
 values(v_client,p_therapist_id,p_market,p_currency,v_fee.amount,v_share,v_fee.amount-v_share,nullif(trim(p_client_message),''),null,70,30,45) returning id into v_request;
 insert into public.payments(appointment_id,request_id,client_id,amount,currency,status,provider,provider_market)
 values(null,v_request,v_client,v_fee.amount,p_currency,'pending','manual_transfer',p_market) returning id into v_payment;
 return query select v_request,v_payment,v_fee.amount,p_currency;
end; $$;

create or replace function public.admin_set_client_intake(p_enabled boolean,p_policy_version text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_admin uuid:=auth.uid(); v_version text:=trim(coalesce(p_policy_version,'')); v_active_therapists integer;
begin
 perform public.require_admin_aal2();
 if p_enabled is null then raise exception 'intake_state_required' using errcode='22023'; end if;
 if p_enabled and (length(v_version)<5 or length(v_version)>80 or v_version ilike '%draft%' or v_version ilike '%test%' or v_version ilike '%preview%') then raise exception 'approved_policy_version_required' using errcode='22023'; end if;
 if p_enabled then
  select count(*) into v_active_therapists from public.therapists t where t.verified_at is not null and t.is_listed and t.accepting_new_clients and exists(select 1 from public.therapist_fees f where f.therapist_id=t.id);
  if v_active_therapists<1 then raise exception 'at_least_one_verified_priced_therapist_accepting_clients_required' using errcode='55000'; end if;
 end if;
 insert into public.site_settings(key,value,updated_by,updated_at) values('client_intake_enabled',to_jsonb(p_enabled),v_admin,now()),('client_policy_version',to_jsonb(v_version),v_admin,now())
 on conflict(key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=now();
 return true;
end; $$;
