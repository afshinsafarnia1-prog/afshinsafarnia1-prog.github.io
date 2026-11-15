-- YAD Center platform completion migration (draft).
-- Apply only after schema.sql, upgrade-client-choice-payment-first.sql,
-- workshops-events.sql, admin-mfa-aal2.sql, admin-mfa-aal2-sql-rpcs.sql,
-- and central-tariffs-contacts-7030.sql.
-- This file is prepared for review; it has NOT been executed against Supabase.
-- Legal policy version below is a product placeholder, not a legal opinion.

alter table public.therapists
  add column if not exists years_experience integer check (years_experience between 0 and 60),
  add column if not exists practice_jurisdictions text[] not null default '{}',
  add column if not exists accepting_new_clients boolean not null default false;

create table if not exists public.appointment_private_access (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  meeting_url text not null,
  meeting_password text,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint appointment_private_access_https check (meeting_url ~* '^https://')
);
alter table public.appointment_private_access enable row level security;
revoke all on public.appointment_private_access from public, anon, authenticated;

create table if not exists public.client_support_tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid references public.client_requests(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  ticket_type text not null check (ticket_type in ('cancellation','reschedule','complaint','therapist_change','data_request','other')),
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
  consented_at timestamptz not null default now(),
  unique(client_id,policy_version)
);
alter table public.client_policy_consents enable row level security;
revoke all on public.client_policy_consents from public, anon, authenticated;

-- Keep the old low-level RPC private. Requests must pass through the consent wrapper.
revoke all on function public.create_client_request(uuid,text,text,text) from public, anon, authenticated;

create or replace function public.create_client_request_with_consent(
  p_therapist_id uuid,
  p_market text,
  p_currency text,
  p_client_message text default null,
  p_policy_version text default '2026-11-16-v1-draft'
)
returns table(request_id uuid,payment_id uuid,amount bigint,currency text)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_client uuid := auth.uid();
begin
  if v_client is null or not exists(
    select 1 from public.profiles p where p.id=v_client and p.role='client'
  ) then
    raise exception 'client_only' using errcode='42501';
  end if;
  if p_policy_version <> '2026-11-16-v1-draft' then
    raise exception 'policy_version_not_supported' using errcode='22023';
  end if;
  insert into public.client_policy_consents(client_id,policy_version)
  values(v_client,p_policy_version)
  on conflict(client_id,policy_version) do nothing;
  return query
    select * from public.create_client_request(p_therapist_id,p_market,p_currency,p_client_message);
end;
$function$;
revoke all on function public.create_client_request_with_consent(uuid,text,text,text,text) from public,anon;
grant execute on function public.create_client_request_with_consent(uuid,text,text,text,text) to authenticated;

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
declare
  v_jurisdictions text[] := coalesce(p_practice_jurisdictions,'{}'::text[]);
begin
  perform public.require_admin_aal2();
  if p_years_experience is not null and p_years_experience not between 0 and 60 then
    raise exception 'invalid_years_experience' using errcode='22023';
  end if;
  if coalesce(array_length(v_jurisdictions,1),0)>30
     or exists(select 1 from unnest(v_jurisdictions) x where length(trim(x))=0 or length(x)>80) then
    raise exception 'invalid_practice_jurisdictions' using errcode='22023';
  end if;
  update public.therapists
  set years_experience=p_years_experience,
      practice_jurisdictions=array(select distinct trim(x) from unnest(v_jurisdictions) x order by trim(x)),
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
  return query
    select t.id,t.years_experience,t.practice_jurisdictions,t.accepting_new_clients
    from public.therapists t order by t.display_name;
end;
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
  if p_ticket_type not in ('cancellation','reschedule','complaint','therapist_change','data_request','other') then
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

revoke all on function public.admin_set_therapist_public_metadata(uuid,integer,text[],boolean) from public,anon;
revoke all on function public.admin_list_therapist_public_metadata() from public,anon;
revoke all on function public.admin_set_appointment_meeting(uuid,text,text) from public,anon;
revoke all on function public.client_list_appointments() from public,anon;
revoke all on function public.client_submit_support_ticket(text,text,uuid,uuid) from public,anon;
revoke all on function public.client_list_support_tickets() from public,anon;
revoke all on function public.admin_list_support_tickets(integer) from public,anon;
revoke all on function public.admin_update_support_ticket(uuid,text,text) from public,anon;
revoke all on function public.admin_mark_appointment_completed(uuid) from public,anon;
revoke all on function public.client_submit_appointment_feedback(uuid,integer,text) from public,anon;
revoke all on function public.admin_list_appointment_feedback(integer) from public,anon;
revoke all on function public.admin_moderate_appointment_feedback(uuid,text) from public,anon;
revoke all on function public.get_public_therapist_feedback(uuid) from public;
grant execute on function public.admin_set_therapist_public_metadata(uuid,integer,text[],boolean) to authenticated;
grant execute on function public.admin_list_therapist_public_metadata() to authenticated;
grant execute on function public.admin_set_appointment_meeting(uuid,text,text) to authenticated;
grant execute on function public.client_list_appointments() to authenticated;
grant execute on function public.client_submit_support_ticket(text,text,uuid,uuid) to authenticated;
grant execute on function public.client_list_support_tickets() to authenticated;
grant execute on function public.admin_list_support_tickets(integer) to authenticated;
grant execute on function public.admin_update_support_ticket(uuid,text,text) to authenticated;
grant execute on function public.admin_mark_appointment_completed(uuid) to authenticated;
grant execute on function public.client_submit_appointment_feedback(uuid,integer,text) to authenticated;
grant execute on function public.admin_list_appointment_feedback(integer) to authenticated;
grant execute on function public.admin_moderate_appointment_feedback(uuid,text) to authenticated;
grant execute on function public.get_public_therapist_feedback(uuid) to anon,authenticated;
