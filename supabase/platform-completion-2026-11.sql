-- YAD Center platform completion migration.
-- REVIEW DRAFT ONLY. This file has NOT been executed against Supabase.
-- Apply only after the existing base, workflow, workshop, AAL2 and central tariff migrations.
-- The policy version is a product placeholder. Obtain jurisdiction-specific legal review before launch.

alter table public.therapists
  add column if not exists years_experience integer check (years_experience between 0 and 60),
  add column if not exists practice_jurisdictions text[] not null default '{}',
  add column if not exists accepting_new_clients boolean not null default false;

create table if not exists public.appointment_private_access (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  meeting_url text not null check (meeting_url ~* '^https://'),
  meeting_password text,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.appointment_private_access enable row level security;
revoke all on public.appointment_private_access from public, anon, authenticated;

create table if not exists public.client_support_tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid references public.client_requests(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  ticket_type text not null check (ticket_type in ('cancellation','reschedule','complaint','therapist_change','data_request','account_deletion','other')),
  message text not null check (length(message) between 8 and 2000),
  status text not null default 'new' check (status in ('new','in_review','resolved','declined')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_support_tickets_client_idx on public.client_support_tickets(client_id,created_at desc);
create index if not exists client_support_tickets_status_idx on public.client_support_tickets(status,created_at desc);
alter table public.client_support_tickets enable row level security;
revoke all on public.client_support_tickets from public, anon, authenticated;

create table if not exists public.client_appointment_feedback (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  feedback text check (feedback is null or length(feedback)<=1500),
  status text not null default 'pending' check (status in ('pending','published','hidden')),
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_feedback_therapist_public_idx on public.client_appointment_feedback(therapist_id,created_at desc) where status='published';
alter table public.client_appointment_feedback enable row level security;
revoke all on public.client_appointment_feedback from public, anon, authenticated;

create table if not exists public.client_policy_consents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  policy_version text not null,
  client_country_code text not null check (char_length(client_country_code)=2 and client_country_code !~ '[^A-Z]'),
  adult_confirmed_at timestamptz not null default now(),
  consented_at timestamptz not null default now(),
  unique(client_id,policy_version)
);
alter table public.client_policy_consents enable row level security;
revoke all on public.client_policy_consents from public, anon, authenticated;

create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('appointment','session_access','support')),
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists client_notifications_inbox_idx on public.client_notifications(client_id,created_at desc);
alter table public.client_notifications enable row level security;
revoke all on public.client_notifications from public, anon, authenticated;

-- Require consent, adult confirmation and the client's actual session country before creating a paid request.
revoke all on function public.create_client_request(uuid,text,text,text) from public, anon, authenticated;

create or replace function public.create_client_request_with_consent(
  p_therapist_id uuid,
  p_market text,
  p_currency text,
  p_client_message text default null,
  p_policy_version text default '2026-11-16-v1-draft',
  p_adult_confirmation boolean default false,
  p_country_code text default null,
  p_timezone text default null
)
returns table(request_id uuid,payment_id uuid,amount bigint,currency text)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_client uuid := auth.uid();
  v_country text := upper(trim(coalesce(p_country_code,'')));
  v_created record;
begin
  if v_client is null or not exists(
    select 1 from public.profiles p where p.id=v_client and p.role='client'
  ) then
    raise exception 'client_only' using errcode='42501';
  end if;
  if p_policy_version <> '2026-11-16-v1-draft' then
    raise exception 'policy_version_not_supported' using errcode='22023';
  end if;
  if p_adult_confirmation is distinct from true then
    raise exception 'adult_confirmation_required' using errcode='22023';
  end if;
  if char_length(v_country)<>2 or v_country ~ '[^A-Z]' then
    raise exception 'valid_session_country_required' using errcode='22023';
  end if;
  if p_timezone is null or length(p_timezone)>64
     or not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=p_timezone) then
    raise exception 'valid_session_timezone_required' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.therapists t
    where t.id=p_therapist_id and t.is_listed and t.verified_at is not null
      and v_country=any(t.practice_jurisdictions)
  ) then
    raise exception 'therapist_not_authorized_for_client_location' using errcode='42501';
  end if;

  update public.profiles
    set country_code=v_country,timezone=p_timezone,updated_at=now()
    where id=v_client;

  insert into public.client_policy_consents(client_id,policy_version,client_country_code,adult_confirmed_at)
  values(v_client,p_policy_version,v_country,now())
  on conflict(client_id,policy_version) do update
    set client_country_code=excluded.client_country_code,
        adult_confirmed_at=now(),consented_at=now();

  select * into v_created
  from public.create_client_request(p_therapist_id,p_market,p_currency,p_client_message);

  return query select v_created.request_id,v_created.payment_id,v_created.amount,v_created.currency;
end;
$function$;
revoke all on function public.create_client_request_with_consent(uuid,text,text,text,text,boolean,text,text) from public,anon;
grant execute on function public.create_client_request_with_consent(uuid,text,text,text,text,boolean,text,text) to authenticated;

create or replace function public.client_update_country_code(p_country_code text)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare v_client uuid:=auth.uid(); v_country text:=upper(trim(coalesce(p_country_code,'')));
begin
  if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  if char_length(v_country)<>2 or v_country ~ '[^A-Z]' then
    raise exception 'invalid_country_code' using errcode='22023';
  end if;
  update public.profiles set country_code=v_country,updated_at=now() where id=v_client;
  return true;
end;
$function$;

create or replace function public.admin_set_therapist_public_metadata(
  p_therapist_id uuid,
  p_years_experience integer,
  p_practice_jurisdictions text[],
  p_accepting_new_clients boolean
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare v_jurisdictions text[]:=coalesce(p_practice_jurisdictions,'{}'::text[]);
begin
  perform public.require_admin_aal2();
  if p_years_experience is not null and p_years_experience not between 0 and 60 then
    raise exception 'invalid_years_experience' using errcode='22023';
  end if;
  if coalesce(array_length(v_jurisdictions,1),0)>30
     or exists(select 1 from unnest(v_jurisdictions) x where char_length(trim(x))<>2 or trim(x) ~ '[^A-Z]') then
    raise exception 'invalid_practice_jurisdictions_use_uppercase_iso2' using errcode='22023';
  end if;
  update public.therapists
  set years_experience=p_years_experience,
      practice_jurisdictions=array(select distinct upper(trim(x)) from unnest(v_jurisdictions) x order by upper(trim(x))),
      accepting_new_clients=coalesce(p_accepting_new_clients,false),
      updated_at=now()
  where id=p_therapist_id;
  if not found then raise exception 'therapist_not_found' using errcode='P0002'; end if;
  return true;
end;
$function$;

create or replace function public.admin_list_therapist_public_metadata()
returns table(therapist_id uuid,years_experience integer,practice_jurisdictions text[],accepting_new_clients boolean)
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform public.require_admin_aal2();
  return query select t.id,t.years_experience,t.practice_jurisdictions,t.accepting_new_clients
    from public.therapists t order by t.display_name;
end;
$function$;

create or replace function public.get_public_therapist_directory_metadata()
returns table(therapist_id uuid,years_experience integer,practice_jurisdictions text[],accepting_new_clients boolean)
language sql
stable
security definer
set search_path=''
as $function$
  select t.id,t.years_experience,t.practice_jurisdictions,t.accepting_new_clients
  from public.therapists t
  where t.is_listed and t.verified_at is not null
  order by t.display_name;
$function$;

create or replace function public.get_public_therapist_public_metadata(p_therapist_id uuid)
returns table(years_experience integer,practice_jurisdictions text[],accepting_new_clients boolean)
language sql
stable
security definer
set search_path=''
as $function$
  select t.years_experience,t.practice_jurisdictions,t.accepting_new_clients
  from public.therapists t
  where t.id=p_therapist_id and t.is_listed and t.verified_at is not null;
$function$;

create or replace function public.admin_set_appointment_meeting(
  p_appointment_id uuid,
  p_meeting_url text,
  p_meeting_password text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare v_admin uuid:=auth.uid();
begin
  perform public.require_admin_aal2();
  if p_meeting_url is null or length(p_meeting_url)>1000 or p_meeting_url !~* '^https://' then
    raise exception 'meeting_url_must_be_https' using errcode='22023';
  end if;
  if p_meeting_password is not null and length(p_meeting_password)>160 then
    raise exception 'meeting_password_too_long' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.appointments a
    join public.payments p on p.appointment_id=a.id and p.status='paid'
    where a.id=p_appointment_id and a.status='confirmed'
  ) then raise exception 'paid_confirmed_appointment_required' using errcode='P0001'; end if;
  insert into public.appointment_private_access(appointment_id,meeting_url,meeting_password,updated_by,updated_at)
  values(p_appointment_id,trim(p_meeting_url),nullif(trim(p_meeting_password),''),v_admin,now())
  on conflict(appointment_id) do update set
    meeting_url=excluded.meeting_url,meeting_password=excluded.meeting_password,
    updated_by=excluded.updated_by,updated_at=now();
  return true;
end;
$function$;

create or replace function public.admin_list_appointment_private_access()
returns table(appointment_id uuid,client_name text,therapist_name text,starts_at timestamptz,ends_at timestamptz,timezone text,appointment_status public.appointment_status,meeting_url text,meeting_password text)
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform public.require_admin_aal2();
  return query
  select a.id,cp.display_name,t.display_name,a.starts_at,a.ends_at,a.timezone,a.status,x.meeting_url,x.meeting_password
  from public.appointments a
  join public.profiles cp on cp.id=a.client_id
  join public.therapists t on t.id=a.therapist_id
  left join public.appointment_private_access x on x.appointment_id=a.id
  where a.status in ('confirmed','completed')
  order by a.starts_at desc limit 200;
end;
$function$;

create or replace function public.client_list_appointments()
returns table(
  appointment_id uuid,therapist_name text,starts_at timestamptz,ends_at timestamptz,
  timezone text,appointment_status public.appointment_status,meeting_url text,meeting_password text,
  can_leave_feedback boolean
)
language plpgsql
security definer
set search_path=''
as $function$
declare v_client uuid:=auth.uid();
begin
  if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  return query
  select a.id,t.display_name,a.starts_at,a.ends_at,a.timezone,a.status,
    case when a.status='confirmed' and pay.status='paid' then access.meeting_url else null end,
    case when a.status='confirmed' and pay.status='paid' then access.meeting_password else null end,
    (a.status='completed' and not exists(select 1 from public.client_appointment_feedback f where f.appointment_id=a.id))
  from public.appointments a
  join public.therapists t on t.id=a.therapist_id
  left join public.payments pay on pay.appointment_id=a.id
  left join public.appointment_private_access access on access.appointment_id=a.id
  where a.client_id=v_client
  order by a.starts_at desc;
end;
$function$;

create or replace function public.client_submit_support_ticket(
  p_ticket_type text,
  p_message text,
  p_request_id uuid default null,
  p_appointment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare v_client uuid:=auth.uid(); v_id uuid;
begin
  if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  if p_ticket_type not in ('cancellation','reschedule','complaint','therapist_change','data_request','account_deletion','other') then
    raise exception 'invalid_ticket_type' using errcode='22023';
  end if;
  if p_message is null or length(trim(p_message))<8 or length(p_message)>2000 then
    raise exception 'invalid_message_length' using errcode='22023';
  end if;
  if p_request_id is not null and not exists(select 1 from public.client_requests r where r.id=p_request_id and r.client_id=v_client) then
    raise exception 'request_not_found' using errcode='P0002';
  end if;
  if p_appointment_id is not null and not exists(select 1 from public.appointments a where a.id=p_appointment_id and a.client_id=v_client) then
    raise exception 'appointment_not_found' using errcode='P0002';
  end if;
  if p_ticket_type in ('cancellation','reschedule','complaint','therapist_change')
     and p_request_id is null and p_appointment_id is null then
    raise exception 'request_or_appointment_required' using errcode='22023';
  end if;
  if (select count(*) from public.client_support_tickets s where s.client_id=v_client and s.created_at>now()-interval '1 day')>=10 then
    raise exception 'support_rate_limit' using errcode='P0001';
  end if;
  insert into public.client_support_tickets(client_id,request_id,appointment_id,ticket_type,message)
  values(v_client,p_request_id,p_appointment_id,p_ticket_type,trim(p_message))
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.client_list_support_tickets()
returns table(ticket_id uuid,ticket_type text,message text,status text,admin_note text,created_at timestamptz,request_id uuid,appointment_id uuid)
language plpgsql
security definer
set search_path=''
as $function$
declare v_client uuid:=auth.uid();
begin
  if v_client is null then raise exception 'authentication_required' using errcode='28000'; end if;
  return query select s.id,s.ticket_type,s.message,s.status,s.admin_note,s.created_at,s.request_id,s.appointment_id
    from public.client_support_tickets s where s.client_id=v_client order by s.created_at desc;
end;
$function$;

create or replace function public.admin_list_support_tickets(p_limit integer default 100)
returns table(ticket_id uuid,client_name text,ticket_type text,message text,status text,admin_note text,created_at timestamptz,request_id uuid,appointment_id uuid)
language plpgsql
security definer
set search_path=''
as $function$
declare v_limit integer:=least(greatest(coalesce(p_limit,100),1),200);
begin
  perform public.require_admin_aal2();
  return query select s.id,p.display_name,s.ticket_type,s.message,s.status,s.admin_note,s.created_at,s.request_id,s.appointment_id
    from public.client_support_tickets s join public.profiles p on p.id=s.client_id
    order by case s.status when 'new' then 0 when 'in_review' then 1 else 2 end,s.created_at desc
    limit v_limit;
end;
$function$;

create or replace function public.admin_update_support_ticket(p_ticket_id uuid,p_status text,p_admin_note text default null)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform public.require_admin_aal2();
  if p_status not in ('new','in_review','resolved','declined') then
    raise exception 'invalid_ticket_status' using errcode='22023';
  end if;
  if p_admin_note is not null and length(p_admin_note)>2000 then
    raise exception 'admin_note_too_long' using errcode='22023';
  end if;
  update public.client_support_tickets set status=p_status,admin_note=nullif(trim(p_admin_note),''),updated_at=now()
  where id=p_ticket_id;
  if not found then raise exception 'ticket_not_found' using errcode='P0002'; end if;
  return true;
end;
$function$;

create or replace function public.admin_resolve_support_cancellation(
  p_ticket_id uuid,
  p_cancel boolean,
  p_refund_completed boolean default false,
  p_admin_note text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_ticket public.client_support_tickets%rowtype;
  v_request_id uuid;
  v_appointment_id uuid;
  v_payment_status public.payment_status;
begin
  perform public.require_admin_aal2();
  select * into v_ticket from public.client_support_tickets where id=p_ticket_id and ticket_type='cancellation' for update;
  if not found then raise exception 'cancellation_ticket_not_found' using errcode='P0002'; end if;
  if not p_cancel then
    update public.client_support_tickets set status='declined',admin_note=nullif(trim(p_admin_note),''),updated_at=now() where id=p_ticket_id;
    return true;
  end if;
  v_request_id:=v_ticket.request_id;
  v_appointment_id:=v_ticket.appointment_id;
  if v_request_id is null and v_appointment_id is not null then
    select r.id into v_request_id from public.client_requests r where r.appointment_id=v_appointment_id limit 1;
  end if;
  if v_request_id is not null then
    select p.status into v_payment_status from public.payments p where p.request_id=v_request_id order by p.created_at desc limit 1 for update;
  elsif v_appointment_id is not null then
    select p.status into v_payment_status from public.payments p where p.appointment_id=v_appointment_id order by p.created_at desc limit 1 for update;
  end if;
  if v_payment_status='paid' and p_refund_completed is distinct from true then
    raise exception 'manual_refund_must_be_completed_before_confirmation' using errcode='P0001';
  end if;
  if v_appointment_id is not null and exists(select 1 from public.appointments a where a.id=v_appointment_id and a.status='completed') then
    raise exception 'completed_appointment_cannot_be_cancelled' using errcode='P0001';
  end if;
  if v_appointment_id is not null then
    update public.appointments set status='cancelled',updated_at=now() where id=v_appointment_id and status in ('confirmed','requested');
  end if;
  if v_request_id is not null then
    update public.client_requests set status='cancelled',updated_at=now() where id=v_request_id and status<>'cancelled';
    update public.payments set status=case when status='paid' then 'refunded'::public.payment_status else 'failed'::public.payment_status end
    where request_id=v_request_id and status in ('paid','pending');
  elsif v_appointment_id is not null then
    update public.payments set status=case when status='paid' then 'refunded'::public.payment_status else 'failed'::public.payment_status end
    where appointment_id=v_appointment_id and status in ('paid','pending');
  end if;
  update public.client_support_tickets set status='resolved',admin_note=nullif(trim(p_admin_note),''),updated_at=now() where id=p_ticket_id;
  return true;
end;
$function$;

create or replace function public.admin_resolve_support_reschedule(
  p_ticket_id uuid,
  p_starts_at timestamptz,
  p_timezone text,
  p_client_confirmed boolean,
  p_admin_note text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_ticket public.client_support_tickets%rowtype;
  v_duration integer:=45;
begin
  perform public.require_admin_aal2();
  select * into v_ticket from public.client_support_tickets where id=p_ticket_id and ticket_type='reschedule' for update;
  if not found or v_ticket.appointment_id is null then raise exception 'reschedule_ticket_not_found' using errcode='P0002'; end if;
  if p_client_confirmed is distinct from true then raise exception 'client_confirmation_required' using errcode='22023'; end if;
  if p_starts_at is null or p_starts_at<=now() then raise exception 'invalid_session_time' using errcode='22023'; end if;
  select coalesce(r.session_duration_minutes,45) into v_duration
  from public.appointments a left join public.client_requests r on r.appointment_id=a.id
  where a.id=v_ticket.appointment_id and a.status='confirmed'
    and exists(select 1 from public.payments p where p.appointment_id=a.id and p.status='paid');
  if not found then raise exception 'paid_confirmed_appointment_required' using errcode='P0001'; end if;
  update public.appointments set starts_at=p_starts_at,ends_at=p_starts_at+make_interval(mins=>v_duration),
    timezone=coalesce(nullif(p_timezone,''),'Asia/Tehran'),updated_at=now()
  where id=v_ticket.appointment_id;
  update public.client_support_tickets set status='resolved',admin_note=nullif(trim(p_admin_note),''),updated_at=now() where id=p_ticket_id;
  return true;
end;
$function$;

create or replace function public.admin_resolve_support_therapist_change(
  p_ticket_id uuid,
  p_new_therapist_id uuid,
  p_admin_note text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_ticket public.client_support_tickets%rowtype;
  v_request_id uuid;
  v_country text;
begin
  perform public.require_admin_aal2();
  select * into v_ticket from public.client_support_tickets where id=p_ticket_id and ticket_type='therapist_change' for update;
  if not found then raise exception 'therapist_change_ticket_not_found' using errcode='P0002'; end if;
  v_request_id:=v_ticket.request_id;
  if v_request_id is null and v_ticket.appointment_id is not null then
    select r.id into v_request_id from public.client_requests r where r.appointment_id=v_ticket.appointment_id limit 1;
  end if;
  if v_request_id is null then raise exception 'request_not_found' using errcode='P0002'; end if;
  if v_ticket.appointment_id is not null and exists(select 1 from public.appointments a where a.id=v_ticket.appointment_id and a.status<>'confirmed') then
    raise exception 'only_confirmed_sessions_can_change_therapist' using errcode='P0001';
  end if;
  select p.country_code into v_country from public.profiles p join public.client_requests r on r.client_id=p.id where r.id=v_request_id;
  if not exists(select 1 from public.therapists t where t.id=p_new_therapist_id and t.is_listed and t.verified_at is not null and v_country=any(t.practice_jurisdictions)) then
    raise exception 'therapist_not_authorized_for_client_location' using errcode='42501';
  end if;
  update public.client_requests set therapist_id=p_new_therapist_id,updated_at=now() where id=v_request_id;
  update public.appointments set therapist_id=p_new_therapist_id,updated_at=now() where id=v_ticket.appointment_id and status='confirmed';
  update public.client_support_tickets set status='resolved',admin_note=nullif(trim(p_admin_note),''),updated_at=now() where id=p_ticket_id;
  return true;
end;
$function$;

create or replace function public.admin_mark_appointment_completed(p_appointment_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform public.require_admin_aal2();
  update public.appointments set status='completed',updated_at=now()
  where id=p_appointment_id and status='confirmed' and ends_at<=now()
    and exists(select 1 from public.payments p where p.appointment_id=p_appointment_id and p.status='paid');
  if not found then raise exception 'appointment_not_ready_to_complete' using errcode='P0001'; end if;
  return true;
end;
$function$;

create or replace function public.client_submit_appointment_feedback(p_appointment_id uuid,p_rating integer,p_feedback text default null)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare v_client uuid:=auth.uid(); v_therapist uuid; v_id uuid;
begin
  if v_client is null then raise exception 'authentication_required' using errcode='28000'; end if;
  if p_rating not between 1 and 5 or (p_feedback is not null and length(p_feedback)>1500) then
    raise exception 'invalid_feedback' using errcode='22023';
  end if;
  select a.therapist_id into v_therapist from public.appointments a
  where a.id=p_appointment_id and a.client_id=v_client and a.status='completed'
    and exists(select 1 from public.payments p where p.appointment_id=a.id and p.status='paid');
  if not found then raise exception 'completed_paid_appointment_required' using errcode='P0001'; end if;
  insert into public.client_appointment_feedback(appointment_id,client_id,therapist_id,rating,feedback)
  values(p_appointment_id,v_client,v_therapist,p_rating,nullif(trim(p_feedback),''))
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.admin_list_appointment_feedback(p_limit integer default 100)
returns table(feedback_id uuid,therapist_name text,rating integer,feedback text,status text,created_at timestamptz)
language plpgsql
security definer
set search_path=''
as $function$
declare v_limit integer:=least(greatest(coalesce(p_limit,100),1),200);
begin
  perform public.require_admin_aal2();
  return query select f.id,t.display_name,f.rating,f.feedback,f.status,f.created_at
  from public.client_appointment_feedback f join public.therapists t on t.id=f.therapist_id
  order by case f.status when 'pending' then 0 when 'published' then 1 else 2 end,f.created_at desc limit v_limit;
end;
$function$;

create or replace function public.admin_moderate_appointment_feedback(p_feedback_id uuid,p_status text)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare v_admin uuid:=auth.uid();
begin
  perform public.require_admin_aal2();
  if p_status not in ('published','hidden') then raise exception 'invalid_feedback_status' using errcode='22023'; end if;
  update public.client_appointment_feedback set status=p_status,reviewed_by=v_admin,updated_at=now() where id=p_feedback_id;
  if not found then raise exception 'feedback_not_found' using errcode='P0002'; end if;
  return true;
end;
$function$;

create or replace function public.get_public_therapist_feedback(p_therapist_id uuid)
returns table(rating integer,feedback text,created_at timestamptz)
language sql
stable
security definer
set search_path=''
as $function$
  select f.rating,f.feedback,f.created_at
  from public.client_appointment_feedback f
  join public.therapists t on t.id=f.therapist_id and t.is_listed and t.verified_at is not null
  where f.therapist_id=p_therapist_id and f.status='published'
  order by f.created_at desc limit 20;
$function$;

revoke all on function public.client_update_country_code(text) from public,anon;
revoke all on function public.admin_set_therapist_public_metadata(uuid,integer,text[],boolean) from public,anon;
revoke all on function public.admin_list_therapist_public_metadata() from public,anon;
revoke all on function public.admin_set_appointment_meeting(uuid,text,text) from public,anon;
revoke all on function public.admin_list_appointment_private_access() from public,anon;
revoke all on function public.notify_client_appointment_update() from public,anon,authenticated;
revoke all on function public.notify_client_support_update() from public,anon,authenticated;
revoke all on function public.notify_client_session_access() from public,anon,authenticated;
revoke all on function public.client_list_notifications() from public,anon;
revoke all on function public.client_mark_notification_read(uuid) from public,anon;
revoke all on function public.client_list_appointments() from public,anon;
revoke all on function public.client_submit_support_ticket(text,text,uuid,uuid) from public,anon;
revoke all on function public.client_list_support_tickets() from public,anon;
revoke all on function public.admin_list_support_tickets(integer) from public,anon;
revoke all on function public.admin_update_support_ticket(uuid,text,text) from public,anon;
revoke all on function public.admin_resolve_support_cancellation(uuid,boolean,boolean,text) from public,anon;
revoke all on function public.admin_resolve_support_reschedule(uuid,timestamptz,text,boolean,text) from public,anon;
revoke all on function public.admin_resolve_support_therapist_change(uuid,uuid,text) from public,anon;
revoke all on function public.admin_mark_appointment_completed(uuid) from public,anon;
revoke all on function public.client_submit_appointment_feedback(uuid,integer,text) from public,anon;
revoke all on function public.admin_list_appointment_feedback(integer) from public,anon;
revoke all on function public.admin_moderate_appointment_feedback(uuid,text) from public,anon;
revoke all on function public.get_public_therapist_feedback(uuid) from public;
revoke all on function public.get_public_therapist_public_metadata(uuid) from public;
revoke all on function public.get_public_therapist_directory_metadata() from public;

grant execute on function public.client_update_country_code(text) to authenticated;
grant execute on function public.admin_set_therapist_public_metadata(uuid,integer,text[],boolean) to authenticated;
grant execute on function public.admin_list_therapist_public_metadata() to authenticated;
grant execute on function public.admin_set_appointment_meeting(uuid,text,text) to authenticated;
grant execute on function public.admin_list_appointment_private_access() to authenticated;
grant execute on function public.client_list_notifications() to authenticated;
grant execute on function public.client_mark_notification_read(uuid) to authenticated;
grant execute on function public.client_list_appointments() to authenticated;
grant execute on function public.client_submit_support_ticket(text,text,uuid,uuid) to authenticated;
grant execute on function public.client_list_support_tickets() to authenticated;
grant execute on function public.admin_list_support_tickets(integer) to authenticated;
grant execute on function public.admin_update_support_ticket(uuid,text,text) to authenticated;
grant execute on function public.admin_resolve_support_cancellation(uuid,boolean,boolean,text) to authenticated;
grant execute on function public.admin_resolve_support_reschedule(uuid,timestamptz,text,boolean,text) to authenticated;
grant execute on function public.admin_resolve_support_therapist_change(uuid,uuid,text) to authenticated;
grant execute on function public.admin_mark_appointment_completed(uuid) to authenticated;
grant execute on function public.client_submit_appointment_feedback(uuid,integer,text) to authenticated;
grant execute on function public.admin_list_appointment_feedback(integer) to authenticated;
grant execute on function public.admin_moderate_appointment_feedback(uuid,text) to authenticated;
grant execute on function public.get_public_therapist_feedback(uuid) to anon,authenticated;
grant execute on function public.get_public_therapist_public_metadata(uuid) to anon,authenticated;
grant execute on function public.get_public_therapist_directory_metadata() to anon,authenticated;
