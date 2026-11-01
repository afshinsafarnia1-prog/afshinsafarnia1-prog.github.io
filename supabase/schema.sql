-- YAD Center backend foundation (Supabase / PostgreSQL)
-- Apply in a NEW Supabase project after reviewing the deployment checklist.
-- Never commit real credentials, bank details, patient notes, or production data.

create extension if not exists pgcrypto;

create type public.account_role as enum ('client', 'therapist', 'admin');
create type public.appointment_status as enum ('requested', 'confirmed', 'completed', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  phone text,
  role public.account_role not null default 'client',
  preferred_language text not null default 'fa',
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id),
  client_id uuid not null references public.profiles(id),
  amount bigint not null check (amount > 0),
  currency text not null check (currency in ('IRR','EUR','USD')),
  status public.payment_status not null default 'pending',
  provider text,
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
create index availability_lookup_idx on public.availability_slots(therapist_id, starts_at) where is_available;
create index payments_client_idx on public.payments(client_id, created_at desc);

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.therapists enable row level security;
alter table public.availability_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;
alter table public.payout_accounts enable row level security;
alter table public.site_settings enable row level security;

-- Profile: users may read/update their own non-role fields.
create policy "profile_select_self" on public.profiles
for select to authenticated using (id = auth.uid());
create policy "profile_update_self" on public.profiles
for update to authenticated using (id = auth.uid())
with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

-- Public therapist directory exposes only listed, verified therapist profiles.
create policy "therapist_public_directory" on public.therapists
for select to anon, authenticated using (is_listed and verified_at is not null);
create policy "therapist_owner_read" on public.therapists
for select to authenticated using (id = auth.uid());
create policy "therapist_owner_update" on public.therapists
for update to authenticated using (id = auth.uid())
with check (id = auth.uid());

-- Availability is public for listed therapists; therapists manage their own slots.
create policy "availability_public_read" on public.availability_slots
for select to anon, authenticated using (
  exists (select 1 from public.therapists t where t.id = therapist_id and t.is_listed and t.verified_at is not null)
);
create policy "availability_owner_manage" on public.availability_slots
for all to authenticated using (therapist_id = auth.uid())
with check (therapist_id = auth.uid());

-- Clients and assigned therapists can see their appointments.
create policy "appointment_participant_read" on public.appointments
for select to authenticated using (client_id = auth.uid() or therapist_id = auth.uid());
create policy "client_create_appointment" on public.appointments
for insert to authenticated with check (client_id = auth.uid());
-- Status transitions, confirmations, payments, refunds and admin actions belong
-- in validated server-side functions; no client-side status update policy.

create policy "payment_client_read" on public.payments
for select to authenticated using (client_id = auth.uid());
-- Payment rows must be written only by trusted server-side payment webhooks.

-- Intentionally no browser-facing policies on payout_accounts or site_settings.
-- Admin-only access must be implemented via server-side service-role functions
-- after verifying the caller's admin role. Do not expose the service-role key.

