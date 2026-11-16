-- YAD Center backend foundation (Supabase / PostgreSQL)
-- Apply in a NEW Supabase project after reviewing the deployment checklist.
-- Never commit real credentials, bank details, patient notes, or production data.
-- One-time bootstrap for an empty project. This file is deliberately not
-- re-runnable: the guard below stops a second/partial deployment before DDL.
-- If it stops, inspect the database and recover deliberately; do not add
-- IF NOT EXISTS indiscriminately or rerun against a partially-created schema.

do $$
begin
  if to_regtype('public.account_role') is not null
     or to_regclass('public.profiles') is not null
     or to_regclass('public.therapists') is not null then
    raise exception 'yadcenter_schema_already_present: inspect current schema before applying';
  end if;
end;
$$;

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.account_role as enum ('client', 'therapist', 'admin');
create type public.appointment_status as enum ('requested', 'confirmed', 'completed', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  phone text,
  role public.account_role not null default 'client',
  preferred_language text not null default 'fa',
  market text not null default 'iran' check (market in ('iran','international')),
  country_code text,
  timezone text not null default 'Asia/Tehran',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.therapists (
  id uuid primary key references public.profiles(id) on delete cascade,
  public_slug text unique not null,
  headline text not null default '',
  biography text not null default '',
  qualifications text[] not null default '{}',
  specialties text[] not null default '{}',
  languages text[] not null default '{fa}',
  session_duration_minutes integer not null default 50 check (session_duration_minutes between 20 and 180),
  fee_amount bigint not null default 0 check (fee_amount >= 0),
  fee_currency text not null default 'IRR' check (fee_currency in ('IRR','EUR','USD')),
  verified_at timestamptz,
  is_listed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.therapist_prices (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  market text not null check (market in ('iran','international')),
  currency text not null check (currency in ('IRR','EUR','USD')),
  amount bigint not null check (amount >= 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (therapist_id, market, currency)
);

create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (therapist_id, starts_at)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id),
  therapist_id uuid not null references public.therapists(id),
  slot_id uuid references public.availability_slots(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'requested',
  client_message text,
  market text not null default 'iran' check (market in ('iran','international')),
  timezone text not null default 'Asia/Tehran',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint appointments_no_overlapping_active_sessions
    exclude using gist (
      therapist_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    )
    where (status in ('requested', 'confirmed'))
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id),
  client_id uuid not null references public.profiles(id),
  amount bigint not null check (amount > 0),
  currency text not null check (currency in ('IRR','EUR','USD')),
  status public.payment_status not null default 'pending',
  provider text,
  provider_market text not null default 'iran' check (provider_market in ('iran','international')),
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- Payout configuration is private. Store provider tokens/credentials in server-side
-- secrets, not here. Never expose these rows to clients or therapists.
create table public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  country_code text not null,
  currency text not null check (currency in ('IRR','EUR','USD')),
  account_holder text not null,
  account_identifier_encrypted text not null,
  is_active boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create index appointments_client_idx on public.appointments(client_id, starts_at desc);
create index appointments_therapist_idx on public.appointments(therapist_id, starts_at desc);
create index appointments_created_idx on public.appointments(created_at desc);
create index appointments_slot_idx on public.appointments(slot_id) where slot_id is not null;
create index availability_lookup_idx on public.availability_slots(therapist_id, starts_at) where is_available;
create index payments_client_idx on public.payments(client_id, created_at desc);
create index payments_appointment_idx on public.payments(appointment_id);
create index payments_status_created_idx on public.payments(status, created_at desc);
create index payout_accounts_updated_by_idx on public.payout_accounts(updated_by) where updated_by is not null;
create index site_settings_updated_by_idx on public.site_settings(updated_by) where updated_by is not null;

-- New auth users receive a client profile. Role changes to therapist/admin must
-- happen only through a trusted server-side admin operation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

-- Trigger execution does not require clients to have direct EXECUTE access.
-- Keep the SECURITY DEFINER trigger function unavailable as a browser RPC.
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.therapists enable row level security;
alter table public.therapist_prices enable row level security;
alter table public.availability_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;
alter table public.payout_accounts enable row level security;
alter table public.site_settings enable row level security;

-- Profile: users may read their own profile. Profile edits and all role
-- assignments are deliberately reserved for a validated server-side function.
create policy "profile_select_self" on public.profiles
for select to authenticated using (id = auth.uid());

-- Public therapist directory exposes only listed, verified therapist profiles.
create policy "therapist_public_directory" on public.therapists
for select to anon, authenticated using (is_listed and verified_at is not null);
create policy "therapist_owner_read" on public.therapists
for select to authenticated using (id = auth.uid());
create policy "therapist_prices_public_read" on public.therapist_prices
for select to anon, authenticated using (
  is_active and exists (
    select 1 from public.therapists t
    where t.id = therapist_id and t.is_listed and t.verified_at is not null
  )
);
-- Therapist profile creation/verification/edits are server-side only so a
-- user cannot self-verify or publish an unreviewed clinical profile.

-- Availability is public for listed therapists; therapists manage their own slots.
create policy "availability_public_read" on public.availability_slots
for select to anon, authenticated using (
  is_available and starts_at > now()
  and exists (
    select 1 from public.therapists t
    where t.id = therapist_id and t.is_listed and t.verified_at is not null
  )
);
-- Only accounts whose role was assigned through a trusted admin process may
-- create or change their own availability. Client accounts cannot create slots.
create policy "availability_owner_manage" on public.availability_slots
for all to authenticated
using (
  therapist_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'therapist'
  )
)
with check (
  therapist_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'therapist'
  )
);

-- Clients and assigned therapists can see their appointments.
create policy "appointment_participant_read" on public.appointments
for select to authenticated using (client_id = auth.uid() or therapist_id = auth.uid());
-- Direct browser inserts are intentionally disabled. New appointments must go
-- through request_appointment(), which validates and locks a real slot, checks
-- therapist listing/verification and market pricing, and creates the payment row
-- atomically. This prevents forged appointments and bypassing the slot workflow.
-- Status transitions, confirmations, payments, refunds and admin actions belong
-- in validated server-side functions; no client-side status update policy.

create policy "payment_client_read" on public.payments
for select to authenticated using (client_id = auth.uid());
-- Payment rows must be written only by trusted server-side payment webhooks.

-- Intentionally no browser-facing policies on payout_accounts or site_settings.
-- Admin-only access must be implemented via server-side service-role functions
-- after verifying the caller's admin role. Do not expose the service-role key.



-- Controlled manual-transfer workflow for the initial release.
-- Clients may request a slot and submit a transfer reference; only an admin
-- can mark the payment as received and confirm the appointment.
create or replace function public.request_appointment(
  p_slot_id uuid,
  p_market text,
  p_currency text,
  p_client_message text default null
)
returns table (appointment_id uuid, payment_id uuid, amount bigint, currency text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_slot public.availability_slots%rowtype;
  v_amount bigint;
  v_appointment uuid;
  v_payment uuid;
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = v_user and p.role = 'client'
  ) then
    raise exception 'client_only' using errcode = '42501';
  end if;
  if p_market not in ('iran','international')
     or p_currency not in ('IRR','EUR','USD') then
    raise exception 'invalid_market_or_currency' using errcode = '22023';
  end if;
  if p_client_message is not null and length(p_client_message) > 500 then
    raise exception 'message_too_long' using errcode = '22023';
  end if;

  select s.* into v_slot
  from public.availability_slots s
  join public.therapists t on t.id = s.therapist_id
  where s.id = p_slot_id
    and s.is_available
    and s.starts_at > now()
    and t.is_listed
    and t.verified_at is not null
  for update of s;

  if not found then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  if (p_market = 'iran' and p_currency <> 'IRR')
     or (p_market = 'international' and p_currency = 'IRR') then
    raise exception 'currency_not_allowed_for_market' using errcode = '22023';
  end if;

  select tp.amount into v_amount
  from public.therapist_prices tp
  where tp.therapist_id = v_slot.therapist_id
    and tp.market = p_market
    and tp.currency = p_currency
    and tp.is_active;

  if v_amount is null or v_amount <= 0 then
    raise exception 'price_not_configured' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.appointments a
    where a.therapist_id = v_slot.therapist_id
      and a.status in ('requested','confirmed')
      and a.starts_at < v_slot.ends_at
      and a.ends_at > v_slot.starts_at
  ) then
    raise exception 'slot_conflict' using errcode = 'P0001';
  end if;

  insert into public.appointments
    (client_id, therapist_id, slot_id, starts_at, ends_at, status,
     client_message, market, timezone)
  values
    (v_user, v_slot.therapist_id, v_slot.id, v_slot.starts_at, v_slot.ends_at,
     'requested', nullif(trim(p_client_message), ''), p_market,
     coalesce((select p.timezone from public.profiles p where p.id = v_user), 'Asia/Tehran'))
  returning id into v_appointment;

  insert into public.payments
    (appointment_id, client_id, amount, currency, status, provider, provider_market)
  values
    (v_appointment, v_user, v_amount, p_currency, 'pending', 'manual_transfer', p_market)
  returning id into v_payment;

  update public.availability_slots set is_available = false where id = v_slot.id;

  return query select v_appointment, v_payment, v_amount, p_currency;
end;
$$;

create or replace function public.submit_manual_payment_reference(
  p_payment_id uuid,
  p_reference text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = v_user and p.role = 'client'
  ) then
    raise exception 'client_only' using errcode = '42501';
  end if;
  if p_reference is null or length(trim(p_reference)) < 4 or length(trim(p_reference)) > 120 then
    raise exception 'invalid_payment_reference' using errcode = '22023';
  end if;

  update public.payments
  set provider = 'manual_transfer',
      provider_reference = trim(p_reference)
  where id = p_payment_id
    and client_id = v_user
    and status = 'pending';

  if not found then
    raise exception 'payment_not_found_or_not_pending' using errcode = 'P0001';
  end if;
  return true;
end;
$$;

create or replace function public.admin_review_manual_payment(
  p_payment_id uuid,
  p_approve boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_appointment_id uuid;
  v_slot_id uuid;
begin
  if v_admin is null or not exists (
    select 1 from public.profiles p where p.id = v_admin and p.role = 'admin'
  ) then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  select p.appointment_id into v_appointment_id
  from public.payments p
  where p.id = p_payment_id
    and p.status = 'pending'
    and p.provider = 'manual_transfer'
    and p.provider_reference is not null
  for update;

  if not found then
    raise exception 'payment_not_ready_for_review' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.appointments a
    where a.id = v_appointment_id and a.status = 'requested'
  ) then
    raise exception 'appointment_not_pending' using errcode = 'P0001';
  end if;

  if p_approve then
    update public.appointments
      set status = 'confirmed', updated_at = now()
      where id = v_appointment_id and status = 'requested';
    update public.payments
      set status = 'paid', paid_at = now()
      where id = p_payment_id and status = 'pending';
  else
    update public.appointments
      set status = 'cancelled', updated_at = now()
      where id = v_appointment_id and status = 'requested'
      returning slot_id into v_slot_id;
    update public.payments set status = 'failed' where id = p_payment_id and status = 'pending';
    if v_slot_id is not null then
      update public.availability_slots set is_available = true where id = v_slot_id;
    end if;
  end if;
  return true;
end;
$$;

-- Admin-only read APIs for the management interface.
-- These SECURITY DEFINER functions bypass table RLS, so they verify the
-- caller's database role on every invocation and are not executable by anon/PUBLIC.
create or replace function public.admin_list_appointments(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  appointment_id uuid,
  client_id uuid,
  client_name text,
  client_phone text,
  therapist_id uuid,
  therapist_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  appointment_status public.appointment_status,
  market text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_admin is null or not exists (
    select 1 from public.profiles p
    where p.id = v_admin and p.role = 'admin'
  ) then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  return query
  select a.id, a.client_id, cp.display_name, cp.phone,
         a.therapist_id, tp.display_name, a.starts_at, a.ends_at,
         a.status, a.market, a.created_at
  from public.appointments a
  join public.profiles cp on cp.id = a.client_id
  join public.profiles tp on tp.id = a.therapist_id
  order by a.created_at desc, a.id
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.admin_list_payments(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  payment_id uuid,
  appointment_id uuid,
  client_id uuid,
  client_name text,
  amount bigint,
  currency text,
  payment_status public.payment_status,
  provider text,
  provider_reference text,
  created_at timestamptz,
  paid_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_admin is null or not exists (
    select 1 from public.profiles p
    where p.id = v_admin and p.role = 'admin'
  ) then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  return query
  select pay.id, pay.appointment_id, pay.client_id, pr.display_name,
         pay.amount, pay.currency, pay.status, pay.provider,
         pay.provider_reference, pay.created_at, pay.paid_at
  from public.payments pay
  join public.profiles pr on pr.id = pay.client_id
  order by pay.created_at desc, pay.id
  limit v_limit offset v_offset;
end;
$$;

-- Restrict direct table writes to the controlled RPC workflow.
revoke insert, update, delete on public.appointments from anon, authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;
revoke insert, update, delete on public.payout_accounts from anon, authenticated;
revoke insert, update, delete on public.site_settings from anon, authenticated;

-- Prevent direct browser execution of privileged functions.
revoke all on function public.request_appointment(uuid,text,text,text) from public, anon;
revoke all on function public.submit_manual_payment_reference(uuid,text) from public, anon;
revoke all on function public.admin_review_manual_payment(uuid,boolean) from public, anon;
revoke all on function public.admin_list_appointments(integer,integer) from public, anon;
revoke all on function public.admin_list_payments(integer,integer) from public, anon;
grant execute on function public.request_appointment(uuid,text,text,text) to authenticated;
grant execute on function public.submit_manual_payment_reference(uuid,text) to authenticated;
grant execute on function public.admin_review_manual_payment(uuid,boolean) to authenticated;
grant execute on function public.admin_list_appointments(integer,integer) to authenticated;
grant execute on function public.admin_list_payments(integer,integer) to authenticated;

-- FIRST ADMIN BOOTSTRAP (manual, one time, after this schema is installed):
-- Verify the intended account in Supabase Authentication > Users, copy its
-- exact User UID, replace the UUID below, then run this statement in the
-- trusted SQL Editor. Do not expose this operation through the client app.
--
-- insert into public.profiles (id, role)
-- select u.id, 'admin'::public.account_role
-- from auth.users u
-- where u.id = 'REPLACE-WITH-VERIFIED-AUTH-USER-UUID'::uuid
--   and not exists (
--     select 1 from public.profiles p where p.role = 'admin'
--   )
-- on conflict (id) do update set role = 'admin', updated_at = now();
--
-- This is intentionally not automatic: the first admin must be explicitly
-- verified by the project owner, and an existing Auth user is not backfilled
-- by the auth.users insert trigger.
