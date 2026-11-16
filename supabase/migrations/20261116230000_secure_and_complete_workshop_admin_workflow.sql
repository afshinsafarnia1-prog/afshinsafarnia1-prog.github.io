-- Secure workshop registration RPCs and complete admin event editing.
create or replace function public.admin_get_workshop(p_workshop_id uuid)
returns table(
 id uuid,slug text,title text,summary text,description text,presenter_name text,presenter_bio text,
 languages text[],topics text[],format text,platform text,venue text,starts_at timestamptz,ends_at timestamptz,
 timezone text,capacity integer,fee_amount bigint,currency text,status text,registration_deadline timestamptz,
 meeting_url text,meeting_password text
)
language plpgsql stable security definer set search_path=''
as $function$
begin
  perform public.require_admin_aal2();
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then
    raise exception 'admin_only' using errcode='42501';
  end if;
  return query select w.id,w.slug,w.title,w.summary,w.description,w.presenter_name,w.presenter_bio,
    w.languages,w.topics,w.format,w.platform,w.venue,w.starts_at,w.ends_at,w.timezone,w.capacity,
    w.fee_amount,w.currency,w.status,w.registration_deadline,w.meeting_url,w.meeting_password
  from public.workshops w where w.id=p_workshop_id;
end;
$function$;
revoke all on function public.admin_get_workshop(uuid) from public,anon;
grant execute on function public.admin_get_workshop(uuid) to authenticated;

create or replace function public.client_list_workshop_registrations()
returns table(registration_id uuid,workshop_id uuid,title text,starts_at timestamptz,ends_at timestamptz,timezone text,format text,platform text,status text,fee_amount bigint,currency text,meeting_url text,meeting_password text)
language plpgsql stable security definer set search_path=''
as $function$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  return query
  select r.id,w.id,w.title,w.starts_at,w.ends_at,w.timezone,w.format,w.platform,r.status,w.fee_amount,w.currency,
    case when w.fee_amount=0 or r.status='paid' then w.meeting_url else null end,
    case when w.fee_amount=0 or r.status='paid' then w.meeting_password else null end
  from public.workshop_registrations r join public.workshops w on w.id=r.workshop_id
  where r.client_id=auth.uid() and r.status<>'cancelled'
  order by w.starts_at;
end;
$function$;
revoke all on function public.client_list_workshop_registrations() from public,anon;
grant execute on function public.client_list_workshop_registrations() to authenticated;

create or replace function public.client_submit_workshop_payment_reference(p_registration_id uuid,p_reference text)
returns void language plpgsql security definer set search_path=''
as $function$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reference,'')))<4 or length(p_reference)>120 then
    raise exception 'invalid_payment_reference' using errcode='22023';
  end if;
  update public.workshop_registrations
  set payment_reference=trim(p_reference),updated_at=now()
  where id=p_registration_id and client_id=auth.uid() and status='pending_payment';
  if not found then raise exception 'registration_not_found_or_not_pending' using errcode='P0002'; end if;
end;
$function$;
revoke all on function public.client_submit_workshop_payment_reference(uuid,text) from public,anon;
grant execute on function public.client_submit_workshop_payment_reference(uuid,text) to authenticated;

create or replace function public.admin_upsert_workshop(
 p_workshop_id uuid,p_slug text,p_title text,p_summary text,p_description text,
 p_presenter_name text,p_presenter_bio text,p_languages text[],p_topics text[],
 p_format text,p_platform text,p_venue text,p_starts_at timestamptz,p_ends_at timestamptz,
 p_timezone text,p_capacity integer,p_fee_amount bigint,p_currency text,p_status text,
 p_registration_deadline timestamptz,p_meeting_url text,p_meeting_password text
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_admin uuid:=auth.uid(); v_id uuid:=coalesce(p_workshop_id,gen_random_uuid());
begin
  perform public.require_admin_aal2();
  if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
    raise exception 'admin_only' using errcode='42501';
  end if;
  if p_ends_at is null or p_starts_at is null or p_ends_at<=p_starts_at
    or p_status not in ('draft','published','cancelled','completed')
    or coalesce(p_currency,'') not in ('IRR','EUR','USD')
    or coalesce(p_fee_amount,-1)<0
    or nullif(trim(coalesce(p_slug,'')),'') is null
    or trim(p_slug) !~ '^[a-zA-Z0-9-]{3,100}$'
    or length(trim(coalesce(p_title,''))) not between 4 and 180
    or length(trim(coalesce(p_presenter_name,''))) not between 2 and 120
    or (p_capacity is not null and p_capacity not between 1 and 10000)
    or (nullif(trim(coalesce(p_meeting_url,'')),'') is not null and (trim(p_meeting_url) !~ '^https://[^[:space:]]+$' or length(p_meeting_url)>1000))
    or length(coalesce(p_meeting_password,''))>160
    or (p_format not in ('online','in_person','hybrid'))
    or (p_format='online' and p_platform not in ('Zoom','Google Meet','Microsoft Teams','Other'))
    or (p_format='in_person' and p_platform<>'In person')
    or (p_format='hybrid' and p_platform not in ('Zoom','Google Meet','Microsoft Teams','Other','In person'))
    or coalesce(trim(p_timezone),'')='' or length(p_timezone)>80
    or not exists(select 1 from pg_timezone_names z where z.name=p_timezone) then
    raise exception 'invalid_event' using errcode='22023';
  end if;
  insert into public.workshops(id,slug,title,summary,description,presenter_name,presenter_bio,languages,topics,format,platform,venue,starts_at,ends_at,timezone,capacity,fee_amount,currency,status,registration_deadline,meeting_url,meeting_password,created_by,updated_at)
  values(v_id,lower(trim(p_slug)),trim(p_title),left(coalesce(p_summary,''),500),coalesce(p_description,''),trim(p_presenter_name),coalesce(p_presenter_bio,''),coalesce(p_languages,'{fa}'),coalesce(p_topics,'{}'),p_format,p_platform,nullif(trim(coalesce(p_venue,'')),''),p_starts_at,p_ends_at,p_timezone,p_capacity,p_fee_amount,p_currency,p_status,p_registration_deadline,nullif(trim(coalesce(p_meeting_url,'')),''),nullif(trim(coalesce(p_meeting_password,'')),''),v_admin,now())
  on conflict(id) do update set slug=excluded.slug,title=excluded.title,summary=excluded.summary,description=excluded.description,presenter_name=excluded.presenter_name,presenter_bio=excluded.presenter_bio,languages=excluded.languages,topics=excluded.topics,format=excluded.format,platform=excluded.platform,venue=excluded.venue,starts_at=excluded.starts_at,ends_at=excluded.ends_at,timezone=excluded.timezone,capacity=excluded.capacity,fee_amount=excluded.fee_amount,currency=excluded.currency,status=excluded.status,registration_deadline=excluded.registration_deadline,meeting_url=excluded.meeting_url,meeting_password=excluded.meeting_password,updated_at=now();
  return v_id;
end;
$function$;
