-- YAD Center workshops and events: public discovery, managed registration, private meeting access.
create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (length(trim(title)) between 4 and 180),
  summary text not null default '' check (length(summary) <= 500),
  description text not null default '',
  presenter_name text not null,
  presenter_bio text not null default '',
  languages text[] not null default '{fa}',
  topics text[] not null default '{}',
  format text not null default 'online' check (format in ('online','in_person','hybrid')),
  platform text not null default 'Zoom' check (platform in ('Zoom','Google Meet','Microsoft Teams','Other','In person')),
  venue text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Europe/Berlin',
  capacity integer check (capacity is null or capacity between 1 and 10000),
  fee_amount bigint not null default 0 check (fee_amount >= 0),
  currency text not null default 'EUR' check (currency in ('IRR','EUR','USD')),
  status text not null default 'draft' check (status in ('draft','published','cancelled','completed')),
  registration_deadline timestamptz,
  meeting_url text,
  meeting_password text,
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((format='online' and platform <> 'In person') or (format='in_person' and platform='In person') or format='hybrid')
);
create index workshops_public_start_idx on public.workshops(starts_at) where status='published';
create index workshops_status_start_idx on public.workshops(status,starts_at);
alter table public.workshops enable row level security;

create table public.workshop_registrations (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'registered' check (status in ('registered','pending_payment','paid','cancelled')),
  payment_reference text,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workshop_id,client_id)
);
create index workshop_registrations_client_idx on public.workshop_registrations(client_id,registered_at desc);
create index workshop_registrations_workshop_idx on public.workshop_registrations(workshop_id,status);
alter table public.workshop_registrations enable row level security;

create table public.workshop_proposals (
  id uuid primary key default gen_random_uuid(),
  presenter_name text not null check(length(trim(presenter_name)) between 2 and 120),
  contact_email text not null check(length(contact_email) <= 254),
  contact_method text not null default '',
  proposed_title text not null check(length(trim(proposed_title)) between 4 and 180),
  topic text not null default '',
  preferred_language text not null default 'fa',
  proposal text not null default '' check(length(proposal) <= 3000),
  status text not null default 'new' check(status in ('new','reviewing','accepted','declined')),
  created_at timestamptz not null default now()
);
alter table public.workshop_proposals enable row level security;

revoke all on public.workshops, public.workshop_registrations, public.workshop_proposals from anon, authenticated;
grant select (id,slug,title,summary,description,presenter_name,presenter_bio,languages,topics,format,platform,venue,starts_at,ends_at,timezone,capacity,fee_amount,currency,registration_deadline,status,created_at)
on public.workshops to anon, authenticated;

drop policy if exists workshops_public_read on public.workshops;
create policy workshops_public_read on public.workshops
for select to anon, authenticated using (status='published' and starts_at > now() - interval '1 day');

create or replace function public.submit_workshop_proposal(
 p_presenter_name text,p_contact_email text,p_contact_method text,p_proposed_title text,
 p_topic text,p_preferred_language text,p_proposal text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
 if length(trim(coalesce(p_presenter_name,''))) not between 2 and 120
 or length(trim(coalesce(p_contact_email,''))) not between 5 and 254
 or position('@' in p_contact_email)=0
 or length(trim(coalesce(p_proposed_title,''))) not between 4 and 180
 or length(coalesce(p_proposal,''))>3000 then
   raise exception 'invalid_proposal' using errcode='22023';
 end if;
 insert into public.workshop_proposals(presenter_name,contact_email,contact_method,proposed_title,topic,preferred_language,proposal)
 values(trim(p_presenter_name),lower(trim(p_contact_email)),left(coalesce(p_contact_method,''),160),trim(p_proposed_title),left(coalesce(p_topic,''),180),left(coalesce(p_preferred_language,'fa'),8),coalesce(p_proposal,''))
 returning id into v_id;
 return v_id;
end;
$$;

create or replace function public.register_for_workshop(p_workshop_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_event public.workshops%rowtype; v_id uuid; v_status text;
begin
 if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.role='client') then
   raise exception 'client_account_required' using errcode='42501';
 end if;
 select * into v_event from public.workshops where id=p_workshop_id and status='published' for update;
 if not found or v_event.starts_at<=now() or (v_event.registration_deadline is not null and v_event.registration_deadline<now()) then
   raise exception 'registration_closed' using errcode='22023';
 end if;
 if v_event.capacity is not null and (select count(*) from public.workshop_registrations r where r.workshop_id=p_workshop_id and r.status in ('registered','pending_payment','paid'))>=v_event.capacity then
   raise exception 'event_full' using errcode='22023';
 end if;
 v_status:=case when v_event.fee_amount=0 then 'registered' else 'pending_payment' end;
 insert into public.workshop_registrations(workshop_id,client_id,status)
 values(p_workshop_id,v_user,v_status)
 on conflict(workshop_id,client_id) do update set status=case when public.workshop_registrations.status='cancelled' then excluded.status else public.workshop_registrations.status end,
 updated_at=now()
 returning id into v_id;
 return v_id;
end;
$$;

create or replace function public.client_list_workshop_registrations()
returns table(registration_id uuid,workshop_id uuid,title text,starts_at timestamptz,ends_at timestamptz,timezone text,format text,platform text,status text,fee_amount bigint,currency text,meeting_url text,meeting_password text)
language sql stable security definer set search_path=''
as $$
 select r.id,w.id,w.title,w.starts_at,w.ends_at,w.timezone,w.format,w.platform,r.status,w.fee_amount,w.currency,
 case when w.fee_amount=0 or r.status='paid' then w.meeting_url else null end,
 case when w.fee_amount=0 or r.status='paid' then w.meeting_password else null end
 from public.workshop_registrations r join public.workshops w on w.id=r.workshop_id
 where r.client_id=auth.uid() and r.status<>'cancelled'
 order by w.starts_at;
$$;

create or replace function public.admin_upsert_workshop(
 p_workshop_id uuid,p_slug text,p_title text,p_summary text,p_description text,
 p_presenter_name text,p_presenter_bio text,p_languages text[],p_topics text[],
 p_format text,p_platform text,p_venue text,p_starts_at timestamptz,p_ends_at timestamptz,
 p_timezone text,p_capacity integer,p_fee_amount bigint,p_currency text,p_status text,
 p_registration_deadline timestamptz,p_meeting_url text,p_meeting_password text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_admin uuid:=auth.uid(); v_id uuid:=coalesce(p_workshop_id,gen_random_uuid());
begin
 if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
   raise exception 'admin_only' using errcode='42501';
 end if;
 if p_ends_at<=p_starts_at or p_status not in ('draft','published','cancelled','completed') then
   raise exception 'invalid_event' using errcode='22023';
 end if;
 insert into public.workshops(id,slug,title,summary,description,presenter_name,presenter_bio,languages,topics,format,platform,venue,starts_at,ends_at,timezone,capacity,fee_amount,currency,status,registration_deadline,meeting_url,meeting_password,created_by,updated_at)
 values(v_id,trim(p_slug),trim(p_title),coalesce(p_summary,''),coalesce(p_description,''),trim(p_presenter_name),coalesce(p_presenter_bio,''),coalesce(p_languages,'{fa}'),coalesce(p_topics,'{}'),p_format,p_platform,p_venue,p_starts_at,p_ends_at,coalesce(p_timezone,'Europe/Berlin'),p_capacity,coalesce(p_fee_amount,0),p_currency,p_status,p_registration_deadline,nullif(trim(p_meeting_url),''),nullif(trim(p_meeting_password),''),v_admin,now())
 on conflict(id) do update set slug=excluded.slug,title=excluded.title,summary=excluded.summary,description=excluded.description,presenter_name=excluded.presenter_name,presenter_bio=excluded.presenter_bio,languages=excluded.languages,topics=excluded.topics,format=excluded.format,platform=excluded.platform,venue=excluded.venue,starts_at=excluded.starts_at,ends_at=excluded.ends_at,timezone=excluded.timezone,capacity=excluded.capacity,fee_amount=excluded.fee_amount,currency=excluded.currency,status=excluded.status,registration_deadline=excluded.registration_deadline,meeting_url=excluded.meeting_url,meeting_password=excluded.meeting_password,updated_at=now();
 return v_id;
end;
$$;

create or replace function public.admin_list_workshops()
returns table(id uuid,slug text,title text,presenter_name text,starts_at timestamptz,format text,platform text,fee_amount bigint,currency text,status text,registration_count bigint,meeting_url text,meeting_password text)
language sql stable security definer set search_path=''
as $$
 select w.id,w.slug,w.title,w.presenter_name,w.starts_at,w.format,w.platform,w.fee_amount,w.currency,w.status,
 (select count(*) from public.workshop_registrations r where r.workshop_id=w.id and r.status<>'cancelled'),w.meeting_url,w.meeting_password
 from public.workshops w where exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
 order by w.starts_at desc;
$$;

create or replace function public.admin_list_workshop_proposals()
returns table(id uuid,presenter_name text,contact_email text,contact_method text,proposed_title text,topic text,preferred_language text,proposal text,status text,created_at timestamptz)
language sql stable security definer set search_path=''
as $$
 select q.id,q.presenter_name,q.contact_email,q.contact_method,q.proposed_title,q.topic,q.preferred_language,q.proposal,q.status,q.created_at
 from public.workshop_proposals q where exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
 order by q.created_at desc;
$$;

create or replace function public.admin_set_workshop_registration_paid(p_registration_id uuid,p_paid boolean)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then
   raise exception 'admin_only' using errcode='42501';
 end if;
 update public.workshop_registrations set status=case when p_paid then 'paid' else 'pending_payment' end,updated_at=now()
 where id=p_registration_id;
 if not found then raise exception 'registration_not_found' using errcode='P0002'; end if;
end;
$$;

revoke all on function public.submit_workshop_proposal(text,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.register_for_workshop(uuid) from public, anon, authenticated;
revoke all on function public.client_list_workshop_registrations() from public, anon, authenticated;
revoke all on function public.admin_upsert_workshop(uuid,text,text,text,text,text,text,text[],text[],text,text,text,timestamptz,timestamptz,text,integer,bigint,text,text,timestamptz,text,text) from public, anon, authenticated;
revoke all on function public.admin_list_workshops() from public, anon, authenticated;
revoke all on function public.admin_list_workshop_proposals() from public, anon, authenticated;
revoke all on function public.admin_set_workshop_registration_paid(uuid,boolean) from public, anon, authenticated;
grant execute on function public.submit_workshop_proposal(text,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.register_for_workshop(uuid) to authenticated;
grant execute on function public.client_list_workshop_registrations() to authenticated;
grant execute on function public.admin_upsert_workshop(uuid,text,text,text,text,text,text,text[],text[],text,text,text,timestamptz,timestamptz,text,integer,bigint,text,text,timestamptz,text,text) to authenticated;
grant execute on function public.admin_list_workshops() to authenticated;
grant execute on function public.admin_list_workshop_proposals() to authenticated;
grant execute on function public.admin_set_workshop_registration_paid(uuid,boolean) to authenticated;

-- Admin-only participant roster; never expose meeting credentials in the public directory.
create or replace function public.admin_list_workshop_registrations(p_workshop_id uuid)
returns table(registration_id uuid,client_name text,client_email text,status text,registered_at timestamptz,payment_reference text)
language sql stable security definer set search_path=''
as $$
 select r.id,coalesce(p.display_name,''),coalesce(u.email,''),r.status,r.registered_at,r.payment_reference
 from public.workshop_registrations r join public.profiles p on p.id=r.client_id join auth.users u on u.id=r.client_id
 where r.workshop_id=p_workshop_id and exists(select 1 from public.profiles a where a.id=auth.uid() and a.role='admin')
 order by r.registered_at;
$$;
revoke all on function public.admin_list_workshop_registrations(uuid) from public,anon,authenticated;
grant execute on function public.admin_list_workshop_registrations(uuid) to authenticated;

create or replace function public.client_submit_workshop_payment_reference(p_registration_id uuid,p_reference text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or length(trim(coalesce(p_reference,'')))<4 or length(p_reference)>120 then
  raise exception 'invalid_payment_reference' using errcode='22023';
 end if;
 update public.workshop_registrations set payment_reference=trim(p_reference),updated_at=now()
 where id=p_registration_id and client_id=auth.uid() and status='pending_payment';
 if not found then raise exception 'registration_not_found_or_not_pending' using errcode='P0002'; end if;
end;
$$;
revoke all on function public.client_submit_workshop_payment_reference(uuid,text) from public,anon,authenticated;
grant execute on function public.client_submit_workshop_payment_reference(uuid,text) to authenticated;

-- Require a client-supplied payment reference before an administrator can mark a paid event registration as paid.
create or replace function public.admin_set_workshop_registration_paid(p_registration_id uuid,p_paid boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare v_admin uuid:=auth.uid();
begin
 if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
  raise exception 'admin_only' using errcode='42501';
 end if;
 if p_paid then
  update public.workshop_registrations set status='paid',updated_at=now()
  where id=p_registration_id and status='pending_payment' and payment_reference is not null;
 else
  update public.workshop_registrations set status='pending_payment',updated_at=now()
  where id=p_registration_id and status in ('pending_payment','paid');
 end if;
 if not found then raise exception 'registration_not_found_or_reference_missing' using errcode='P0002'; end if;
end;
$$;
