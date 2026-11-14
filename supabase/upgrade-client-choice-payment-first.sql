-- YAD Center: managed therapist directory + client-selected, payment-first workflow.
-- Apply only after supabase/schema.sql on a fresh project.
-- This consolidated upgrade reflects the live migration sequence applied on 2026-11-14:
-- client_choice_payment_first_workflow
-- complete_request_status_and_admin_lists
-- revoke_unneeded_event_trigger_rpc
-- include_payment_id_in_client_request_history
-- therapist_market_prices_and_revenue_split
-- tighten_rls_and_add_workflow_indexes
-- remove_redundant_admin_select_policies
-- enforce_revenue_split_consistency
-- Do not rerun against a database where these migrations are already recorded.

alter table public.therapists drop constraint if exists therapists_id_fkey;
alter table public.therapists alter column id set default gen_random_uuid();
alter table public.therapists
  add column if not exists display_name text not null default '',
  add column if not exists photo_path text,
  add column if not exists modalities text[] not null default '{}';

create table if not exists public.therapist_private_verification (
  therapist_id uuid primary key references public.therapists(id) on delete cascade,
  license_number text,
  issuing_authority text,
  document_path text,
  verification_notes text,
  verified_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.therapist_private_verification enable row level security;

create table if not exists public.client_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id),
  therapist_id uuid not null references public.therapists(id),
  market text not null check (market in ('iran','international')),
  currency text not null check (currency in ('IRR','EUR','USD')),
  amount bigint not null check (amount > 0),
  therapist_share_amount bigint not null default 0,
  platform_share_amount bigint not null default 0,
  client_message text,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','payment_submitted','payment_verified','scheduled','cancelled')),
  appointment_id uuid references public.appointments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((market = 'iran' and currency = 'IRR') or (market = 'international' and currency in ('EUR','USD'))),
  constraint client_requests_revenue_split_check check (therapist_share_amount + platform_share_amount = amount)
);
create index if not exists client_requests_client_created_idx on public.client_requests(client_id,created_at desc);
create index if not exists client_requests_status_created_idx on public.client_requests(status,created_at desc);
create index if not exists client_requests_appointment_idx on public.client_requests(appointment_id) where appointment_id is not null;
create index if not exists client_requests_therapist_idx on public.client_requests(therapist_id);
alter table public.client_requests enable row level security;

drop policy if exists "client_requests_read_own" on public.client_requests;
create policy "client_requests_read_own" on public.client_requests
for select to authenticated using (client_id = (select auth.uid()));

alter table public.payments alter column appointment_id drop not null;
alter table public.payments add column if not exists request_id uuid references public.client_requests(id);
do $$
begin
  if not exists(select 1 from pg_constraint where conname='payments_appointment_or_request_check' and conrelid='public.payments'::regclass) then
    alter table public.payments add constraint payments_appointment_or_request_check
      check (appointment_id is not null or request_id is not null);
  end if;
  if not exists(select 1 from pg_constraint where conname='client_requests_revenue_split_check' and conrelid='public.client_requests'::regclass) then
    alter table public.client_requests add constraint client_requests_revenue_split_check
      check (therapist_share_amount + platform_share_amount = amount);
  end if;
end;
$$;
create unique index if not exists payments_request_id_unique on public.payments(request_id) where request_id is not null;

drop policy if exists "availability_owner_manage" on public.availability_slots;
drop policy if exists "availability_admin_manage" on public.availability_slots;
drop policy if exists "therapist_owner_read" on public.therapists;
drop policy if exists "therapist_admin_read" on public.therapists;
drop policy if exists "profile_select_self" on public.profiles;
create policy "profile_select_self" on public.profiles
for select to authenticated using (id = (select auth.uid()));
drop policy if exists "appointment_participant_read" on public.appointments;
create policy "appointment_participant_read" on public.appointments
for select to authenticated using (client_id=(select auth.uid()) or therapist_id=(select auth.uid()));
drop policy if exists "payment_client_read" on public.payments;
create policy "payment_client_read" on public.payments
for select to authenticated using (client_id=(select auth.uid()));
drop policy if exists "therapist_verification_admin_read" on public.therapist_private_verification;
create policy "therapist_verification_admin_read" on public.therapist_private_verification
for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
);
create index if not exists therapist_private_verification_verified_by_idx
  on public.therapist_private_verification(verified_by) where verified_by is not null;

create or replace function public.admin_save_therapist(
  p_therapist_id uuid,p_public_slug text,p_display_name text,p_headline text,p_biography text,
  p_qualifications text[],p_specialties text[],p_languages text[],p_modalities text[],
  p_session_duration_minutes integer,p_fee_amount bigint,p_fee_currency text,p_photo_path text,
  p_license_number text,p_issuing_authority text,p_document_path text,p_verified boolean,p_is_listed boolean
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_admin uuid:=auth.uid();
  v_id uuid:=coalesce(p_therapist_id,gen_random_uuid());
begin
  if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
    raise exception 'admin_only' using errcode='42501';
  end if;
  if nullif(trim(p_public_slug),'') is null or nullif(trim(p_display_name),'') is null then
    raise exception 'therapist_name_and_slug_required' using errcode='22023';
  end if;
  if p_session_duration_minutes not between 20 and 180 or p_fee_amount<0 or p_fee_currency not in ('IRR','EUR','USD') then
    raise exception 'invalid_therapist_terms' using errcode='22023';
  end if;
  if coalesce(p_is_listed,false) and not coalesce(p_verified,false) then
    raise exception 'verification_required_before_publication' using errcode='22023';
  end if;
  insert into public.therapists(
    id,public_slug,display_name,headline,biography,qualifications,specialties,languages,modalities,
    session_duration_minutes,fee_amount,fee_currency,photo_path,verified_at,is_listed,updated_at
  ) values (
    v_id,lower(trim(p_public_slug)),trim(p_display_name),coalesce(p_headline,''),coalesce(p_biography,''),
    coalesce(p_qualifications,'{}'),coalesce(p_specialties,'{}'),coalesce(p_languages,'{fa}'),coalesce(p_modalities,'{}'),
    p_session_duration_minutes,p_fee_amount,p_fee_currency,p_photo_path,
    case when p_verified then now() else null end,coalesce(p_is_listed,false),now()
  )
  on conflict(id) do update set
    public_slug=excluded.public_slug,display_name=excluded.display_name,headline=excluded.headline,
    biography=excluded.biography,qualifications=excluded.qualifications,specialties=excluded.specialties,
    languages=excluded.languages,modalities=excluded.modalities,session_duration_minutes=excluded.session_duration_minutes,
    fee_amount=excluded.fee_amount,fee_currency=excluded.fee_currency,photo_path=excluded.photo_path,
    verified_at=excluded.verified_at,is_listed=excluded.is_listed,updated_at=now();

  insert into public.therapist_private_verification(therapist_id,license_number,issuing_authority,document_path,verified_by,updated_at)
  values(v_id,p_license_number,p_issuing_authority,p_document_path,v_admin,now())
  on conflict(therapist_id) do update set
    license_number=excluded.license_number,issuing_authority=excluded.issuing_authority,
    document_path=coalesce(excluded.document_path,public.therapist_private_verification.document_path),
    verified_by=excluded.verified_by,updated_at=now();
  return v_id;
end;
$$;

create or replace function public.admin_set_therapist_prices(
  p_therapist_id uuid,p_iran_irr bigint,p_international_eur bigint,p_international_usd bigint
)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_admin uuid:=auth.uid();
begin
  if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
    raise exception 'admin_only' using errcode='42501';
  end if;
  if not exists(select 1 from public.therapists t where t.id=p_therapist_id) then
    raise exception 'therapist_not_found' using errcode='P0001';
  end if;
  insert into public.therapist_prices(therapist_id,market,currency,amount,is_active)
  values
    (p_therapist_id,'iran','IRR',greatest(coalesce(p_iran_irr,0),0),coalesce(p_iran_irr,0)>0),
    (p_therapist_id,'international','EUR',greatest(coalesce(p_international_eur,0),0),coalesce(p_international_eur,0)>0),
    (p_therapist_id,'international','USD',greatest(coalesce(p_international_usd,0),0),coalesce(p_international_usd,0)>0)
  on conflict(therapist_id,market,currency) do update
    set amount=excluded.amount,is_active=excluded.is_active,updated_at=now();
  return true;
end;
$$;

create or replace function public.create_client_request(p_therapist_id uuid,p_market text,p_currency text,p_client_message text default null)
returns table(request_id uuid,payment_id uuid,amount bigint,currency text)
language plpgsql security definer set search_path=''
as $$
declare
  v_client uuid:=auth.uid();
  v_amount bigint;
  v_request uuid;
  v_payment uuid;
  v_therapist_share bigint;
begin
  if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  if p_market not in ('iran','international') or (p_market='iran' and p_currency<>'IRR')
    or (p_market='international' and p_currency not in ('EUR','USD')) then
    raise exception 'invalid_market_or_currency' using errcode='22023';
  end if;
  if p_client_message is not null and length(p_client_message)>500 then
    raise exception 'message_too_long' using errcode='22023';
  end if;
  if not exists(select 1 from public.therapists t where t.id=p_therapist_id and t.is_listed and t.verified_at is not null) then
    raise exception 'therapist_not_available' using errcode='P0001';
  end if;
  select tp.amount into v_amount from public.therapist_prices tp
    where tp.therapist_id=p_therapist_id and tp.market=p_market and tp.currency=p_currency and tp.is_active;
  if v_amount is null then
    select t.fee_amount into v_amount from public.therapists t where t.id=p_therapist_id and t.fee_currency=p_currency;
  end if;
  if v_amount is null or v_amount<=0 then raise exception 'price_not_configured' using errcode='P0001'; end if;
  v_therapist_share:=floor(v_amount*0.60)::bigint;
  insert into public.client_requests(client_id,therapist_id,market,currency,amount,therapist_share_amount,platform_share_amount,client_message)
  values(v_client,p_therapist_id,p_market,p_currency,v_amount,v_therapist_share,v_amount-v_therapist_share,nullif(trim(p_client_message),''))
  returning id into v_request;
  insert into public.payments(appointment_id,request_id,client_id,amount,currency,status,provider,provider_market)
  values(null,v_request,v_client,v_amount,p_currency,'pending','manual_transfer',p_market)
  returning id into v_payment;
  return query select v_request,v_payment,v_amount,p_currency;
end;
$$;

create or replace function public.submit_manual_payment_reference(p_payment_id uuid,p_reference text)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_request_id uuid;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='28000'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  if p_reference is null or length(trim(p_reference))<4 or length(trim(p_reference))>120 then
    raise exception 'invalid_payment_reference' using errcode='22023';
  end if;
  update public.payments set provider='manual_transfer',provider_reference=trim(p_reference)
    where id=p_payment_id and client_id=v_user and status='pending'
    returning request_id into v_request_id;
  if not found then raise exception 'payment_not_found_or_not_pending' using errcode='P0001'; end if;
  if v_request_id is not null then
    update public.client_requests set status='payment_submitted',updated_at=now()
      where id=v_request_id and client_id=v_user and status='awaiting_payment';
  end if;
  return true;
end;
$$;

create or replace function public.admin_review_manual_payment(p_payment_id uuid,p_approve boolean)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare
  v_admin uuid:=auth.uid();
  v_payment public.payments%rowtype;
  v_slot_id uuid;
begin
  if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
    raise exception 'admin_only' using errcode='42501';
  end if;
  select * into v_payment from public.payments p
    where p.id=p_payment_id and p.status='pending' and p.provider='manual_transfer' and p.provider_reference is not null
    for update;
  if not found then raise exception 'payment_not_ready_for_review' using errcode='P0001'; end if;
  if v_payment.request_id is not null then
    if not exists(select 1 from public.client_requests r where r.id=v_payment.request_id and r.status='payment_submitted') then
      raise exception 'request_not_pending_payment_review' using errcode='P0001';
    end if;
    if p_approve then
      update public.payments set status='paid',paid_at=now() where id=p_payment_id;
      update public.client_requests set status='payment_verified',updated_at=now() where id=v_payment.request_id;
    else
      update public.payments set status='failed' where id=p_payment_id;
      update public.client_requests set status='cancelled',updated_at=now() where id=v_payment.request_id;
    end if;
    return true;
  end if;
  if v_payment.appointment_id is null or not exists(
    select 1 from public.appointments a where a.id=v_payment.appointment_id and a.status='requested'
  ) then raise exception 'appointment_not_pending' using errcode='P0001'; end if;
  if p_approve then
    update public.appointments set status='confirmed',updated_at=now() where id=v_payment.appointment_id;
    update public.payments set status='paid',paid_at=now() where id=p_payment_id;
  else
    update public.appointments set status='cancelled',updated_at=now()
      where id=v_payment.appointment_id returning slot_id into v_slot_id;
    update public.payments set status='failed' where id=p_payment_id;
    if v_slot_id is not null then update public.availability_slots set is_available=true where id=v_slot_id; end if;
  end if;
  return true;
end;
$$;

drop function if exists public.admin_list_requests(integer,integer);
create function public.admin_list_requests(p_limit integer default 50,p_offset integer default 0)
returns table(
  request_id uuid,client_id uuid,client_name text,client_phone text,therapist_id uuid,therapist_name text,
  amount bigint,currency text,therapist_share_amount bigint,platform_share_amount bigint,
  request_status text,payment_id uuid,payment_status public.payment_status,provider_reference text,created_at timestamptz
)
language plpgsql security definer set search_path=''
as $$
declare
  v_admin uuid:=auth.uid();
  v_limit integer:=least(greatest(coalesce(p_limit,50),1),100);
  v_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
    raise exception 'admin_only' using errcode='42501';
  end if;
  return query
  select r.id,r.client_id,cp.display_name,cp.phone,r.therapist_id,t.display_name,r.amount,r.currency,
    r.therapist_share_amount,r.platform_share_amount,r.status,p.id,p.status,p.provider_reference,r.created_at
  from public.client_requests r
  join public.profiles cp on cp.id=r.client_id
  join public.therapists t on t.id=r.therapist_id
  left join public.payments p on p.request_id=r.id
  order by r.created_at desc,r.id limit v_limit offset v_offset;
end;
$$;

create or replace function public.admin_schedule_request(
  p_request_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_timezone text default 'Asia/Tehran'
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_admin uuid:=auth.uid();
  v_request public.client_requests%rowtype;
  v_appointment uuid;
begin
  if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
    raise exception 'admin_only' using errcode='42501';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at or p_starts_at<=now() then
    raise exception 'invalid_session_time' using errcode='22023';
  end if;
  select * into v_request from public.client_requests r where r.id=p_request_id and r.status='payment_verified' for update;
  if not found then raise exception 'request_not_ready_to_schedule' using errcode='P0001'; end if;
  if not exists(select 1 from public.payments p where p.request_id=p_request_id and p.status='paid') then
    raise exception 'payment_not_verified' using errcode='P0001';
  end if;
  insert into public.appointments(client_id,therapist_id,slot_id,starts_at,ends_at,status,client_message,market,timezone)
  values(v_request.client_id,v_request.therapist_id,null,p_starts_at,p_ends_at,'confirmed',v_request.client_message,
    v_request.market,coalesce(nullif(p_timezone,''),'Asia/Tehran'))
  returning id into v_appointment;
  update public.client_requests set status='scheduled',appointment_id=v_appointment,updated_at=now() where id=p_request_id;
  update public.payments set appointment_id=v_appointment where request_id=p_request_id;
  return v_appointment;
end;
$$;

drop function if exists public.admin_list_therapists();
create function public.admin_list_therapists()
returns table(
  therapist_id uuid,public_slug text,display_name text,headline text,biography text,
  qualifications text[],specialties text[],languages text[],modalities text[],session_duration_minutes integer,
  fee_amount bigint,fee_currency text,photo_path text,verified boolean,is_listed boolean,
  license_number text,issuing_authority text,document_path text,
  iran_irr_fee bigint,international_eur_fee bigint,international_usd_fee bigint
)
language plpgsql security definer set search_path=''
as $$
declare v_admin uuid:=auth.uid();
begin
  if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
    raise exception 'admin_only' using errcode='42501';
  end if;
  return query
  select t.id,t.public_slug,t.display_name,t.headline,t.biography,t.qualifications,t.specialties,t.languages,t.modalities,
    t.session_duration_minutes,t.fee_amount,t.fee_currency,t.photo_path,(t.verified_at is not null),t.is_listed,
    v.license_number,v.issuing_authority,v.document_path,pi.amount,pe.amount,pu.amount
  from public.therapists t
  left join public.therapist_private_verification v on v.therapist_id=t.id
  left join public.therapist_prices pi on pi.therapist_id=t.id and pi.market='iran' and pi.currency='IRR' and pi.is_active
  left join public.therapist_prices pe on pe.therapist_id=t.id and pe.market='international' and pe.currency='EUR' and pe.is_active
  left join public.therapist_prices pu on pu.therapist_id=t.id and pu.market='international' and pu.currency='USD' and pu.is_active
  order by t.created_at desc,t.id;
end;
$$;

drop function if exists public.client_list_requests();
create function public.client_list_requests()
returns table(
  request_id uuid,payment_id uuid,therapist_name text,amount bigint,currency text,
  request_status text,payment_status public.payment_status,provider_reference text,created_at timestamptz
)
language plpgsql security definer set search_path=''
as $$
declare v_client uuid:=auth.uid();
begin
  if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  return query
  select r.id,p.id,t.display_name,r.amount,r.currency,r.status,p.status,p.provider_reference,r.created_at
  from public.client_requests r join public.therapists t on t.id=r.therapist_id
  left join public.payments p on p.request_id=r.id
  where r.client_id=v_client order by r.created_at desc;
end;
$$;

drop function if exists public.admin_list_appointments(integer,integer);
create function public.admin_list_appointments(p_limit integer default 50,p_offset integer default 0)
returns table(
  appointment_id uuid,client_id uuid,client_name text,client_phone text,therapist_id uuid,therapist_name text,
  starts_at timestamptz,ends_at timestamptz,appointment_status public.appointment_status,market text,created_at timestamptz
)
language plpgsql security definer set search_path=''
as $$
declare
  v_admin uuid:=auth.uid();
  v_limit integer:=least(greatest(coalesce(p_limit,50),1),100);
  v_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
    raise exception 'admin_only' using errcode='42501';
  end if;
  return query
  select a.id,a.client_id,cp.display_name,cp.phone,a.therapist_id,t.display_name,a.starts_at,a.ends_at,a.status,a.market,a.created_at
  from public.appointments a join public.profiles cp on cp.id=a.client_id
  join public.therapists t on t.id=a.therapist_id
  order by a.created_at desc,a.id limit v_limit offset v_offset;
end;
$$;

revoke all on function public.admin_save_therapist(uuid,text,text,text,text,text[],text[],text[],text[],integer,bigint,text,text,text,text,text,boolean,boolean) from public,anon;
revoke all on function public.admin_set_therapist_prices(uuid,bigint,bigint,bigint) from public,anon;
revoke all on function public.create_client_request(uuid,text,text,text) from public,anon;
revoke all on function public.submit_manual_payment_reference(uuid,text) from public,anon;
revoke all on function public.admin_review_manual_payment(uuid,boolean) from public,anon;
revoke all on function public.admin_list_requests(integer,integer) from public,anon;
revoke all on function public.admin_schedule_request(uuid,timestamptz,timestamptz,text) from public,anon;
revoke all on function public.admin_list_therapists() from public,anon;
revoke all on function public.client_list_requests() from public,anon;
revoke all on function public.admin_list_appointments(integer,integer) from public,anon;
grant execute on function public.admin_save_therapist(uuid,text,text,text,text,text[],text[],text[],text[],integer,bigint,text,text,text,text,text,boolean,boolean) to authenticated;
grant execute on function public.admin_set_therapist_prices(uuid,bigint,bigint,bigint) to authenticated;
grant execute on function public.create_client_request(uuid,text,text,text) to authenticated;
grant execute on function public.submit_manual_payment_reference(uuid,text) to authenticated;
grant execute on function public.admin_review_manual_payment(uuid,boolean) to authenticated;
grant execute on function public.admin_list_requests(integer,integer) to authenticated;
grant execute on function public.admin_schedule_request(uuid,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.admin_list_therapists() to authenticated;
grant execute on function public.client_list_requests() to authenticated;
grant execute on function public.admin_list_appointments(integer,integer) to authenticated;
grant select on public.therapists to anon,authenticated;
grant select on public.client_requests to authenticated;
revoke all on function public.rls_auto_enable() from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('therapist-photos','therapist-photos',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('therapist-documents','therapist-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "therapist_photos_public_read" on storage.objects;
create policy "therapist_photos_public_read" on storage.objects
for select to anon,authenticated using(bucket_id='therapist-photos');
drop policy if exists "therapist_photos_admin_insert" on storage.objects;
create policy "therapist_photos_admin_insert" on storage.objects
for insert to authenticated with check(bucket_id='therapist-photos' and exists(
 select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists "therapist_photos_admin_update" on storage.objects;
create policy "therapist_photos_admin_update" on storage.objects
for update to authenticated using(bucket_id='therapist-photos' and exists(
 select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))
with check(bucket_id='therapist-photos' and exists(
 select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists "therapist_photos_admin_delete" on storage.objects;
create policy "therapist_photos_admin_delete" on storage.objects
for delete to authenticated using(bucket_id='therapist-photos' and exists(
 select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

drop policy if exists "therapist_documents_admin_select" on storage.objects;
create policy "therapist_documents_admin_select" on storage.objects
for select to authenticated using(bucket_id='therapist-documents' and exists(
 select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists "therapist_documents_admin_insert" on storage.objects;
create policy "therapist_documents_admin_insert" on storage.objects
for insert to authenticated with check(bucket_id='therapist-documents' and exists(
 select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists "therapist_documents_admin_update" on storage.objects;
create policy "therapist_documents_admin_update" on storage.objects
for update to authenticated using(bucket_id='therapist-documents' and exists(
 select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))
with check(bucket_id='therapist-documents' and exists(
 select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists "therapist_documents_admin_delete" on storage.objects;
create policy "therapist_documents_admin_delete" on storage.objects
for delete to authenticated using(bucket_id='therapist-documents' and exists(
 select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
