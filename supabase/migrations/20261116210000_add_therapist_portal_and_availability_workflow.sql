-- Therapist account ownership, own appointments, and availability management.
alter table public.therapists add column if not exists owner_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists therapists_owner_user_id_unique on public.therapists(owner_user_id) where owner_user_id is not null;

create or replace function public.admin_assign_therapist_user(p_therapist_id uuid,p_user_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $function$
begin
  perform public.require_admin_aal2();
  if not exists(select 1 from public.profiles p where p.id=p_user_id and p.role='therapist') then raise exception 'therapist_account_required' using errcode='22023'; end if;
  if not exists(select 1 from public.therapists t where t.id=p_therapist_id and t.verified_at is not null) then raise exception 'verified_therapist_required' using errcode='23514'; end if;
  update public.therapists set owner_user_id=p_user_id,updated_at=now() where id=p_therapist_id;
  if not found then raise exception 'therapist_not_found' using errcode='P0002'; end if;
  return true;
end;
$function$;

create or replace function public.admin_list_availability_slots(p_therapist_id uuid)
returns table(slot_id uuid,starts_at timestamptz,ends_at timestamptz,timezone text,is_available boolean)
language plpgsql stable security definer set search_path=''
as $function$
begin
  perform public.require_admin_aal2();
  if not exists(select 1 from public.therapists t where t.id=p_therapist_id) then raise exception 'therapist_not_found' using errcode='P0002'; end if;
  return query select s.id,s.starts_at,s.ends_at,s.timezone,s.is_available from public.availability_slots s
    where s.therapist_id=p_therapist_id order by s.starts_at;
end;
$function$;

create or replace function public.admin_create_availability_slot(p_therapist_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_timezone text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_id uuid; v_zone text:=trim(coalesce(p_timezone,''));
begin
  perform public.require_admin_aal2();
  if not exists(select 1 from public.therapists t where t.id=p_therapist_id and t.verified_at is not null and t.is_listed) then raise exception 'verified_listed_therapist_required' using errcode='23514'; end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at<=now() or p_ends_at-p_starts_at<>interval '45 minutes' then raise exception 'future_45_minute_slot_required' using errcode='22023'; end if;
  if v_zone='' or length(v_zone)>80 or not exists(select 1 from pg_timezone_names z where z.name=v_zone) then raise exception 'valid_timezone_required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_therapist_id::text,0));
  if exists(select 1 from public.availability_slots s where s.therapist_id=p_therapist_id and s.starts_at<p_ends_at and s.ends_at>p_starts_at) then raise exception 'availability_overlap' using errcode='23P01'; end if;
  insert into public.availability_slots(therapist_id,starts_at,ends_at,is_available,timezone) values(p_therapist_id,p_starts_at,p_ends_at,true,v_zone) returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.admin_delete_availability_slot(p_slot_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $function$
begin
  perform public.require_admin_aal2();
  if exists(select 1 from public.appointments a where a.slot_id=p_slot_id) then raise exception 'slot_has_appointment' using errcode='23503'; end if;
  delete from public.availability_slots where id=p_slot_id;
  if not found then raise exception 'slot_not_found' using errcode='P0002'; end if;
  return true;
end;
$function$;

create or replace function public.therapist_list_appointments()
returns table(appointment_id uuid,client_name text,starts_at timestamptz,ends_at timestamptz,timezone text,appointment_status text,meeting_url text,meeting_password text)
language plpgsql stable security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid();
begin
  if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.role='therapist') then raise exception 'therapist_only' using errcode='42501'; end if;
  return query select a.id,coalesce(p.display_name,'مراجع'),a.starts_at,a.ends_at,a.timezone,a.status::text,
    case when a.status::text='confirmed' and exists(select 1 from public.payments pay where pay.appointment_id=a.id and pay.client_id=a.client_id and pay.status::text='paid') then pa.meeting_url else null::text end,
    case when a.status::text='confirmed' and exists(select 1 from public.payments pay where pay.appointment_id=a.id and pay.client_id=a.client_id and pay.status::text='paid') then pa.meeting_password else null::text end
  from public.appointments a join public.therapists t on t.id=a.therapist_id left join public.profiles p on p.id=a.client_id
  left join public.appointment_private_access pa on pa.appointment_id=a.id where t.owner_user_id=v_user order by a.starts_at;
end;
$function$;

create or replace function public.therapist_list_availability_slots()
returns table(slot_id uuid,starts_at timestamptz,ends_at timestamptz,timezone text,is_available boolean)
language plpgsql stable security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid();
begin
  if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.role='therapist') then raise exception 'therapist_only' using errcode='42501'; end if;
  return query select s.id,s.starts_at,s.ends_at,s.timezone,s.is_available from public.availability_slots s
  join public.therapists t on t.id=s.therapist_id where t.owner_user_id=v_user order by s.starts_at;
end;
$function$;

create or replace function public.therapist_create_availability_slot(p_starts_at timestamptz,p_ends_at timestamptz,p_timezone text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_therapist uuid; v_id uuid; v_zone text:=trim(coalesce(p_timezone,''));
begin
  if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.role='therapist') then raise exception 'therapist_only' using errcode='42501'; end if;
  select t.id into v_therapist from public.therapists t where t.owner_user_id=v_user and t.verified_at is not null and t.is_listed and t.accepting_new_clients;
  if v_therapist is null then raise exception 'verified_accepting_therapist_required' using errcode='42501'; end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at<=now() or p_ends_at-p_starts_at<>interval '45 minutes' then raise exception 'future_45_minute_slot_required' using errcode='22023'; end if;
  if v_zone='' or length(v_zone)>80 or not exists(select 1 from pg_timezone_names z where z.name=v_zone) then raise exception 'valid_timezone_required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_therapist::text,0));
  if exists(select 1 from public.availability_slots s where s.therapist_id=v_therapist and s.starts_at<p_ends_at and s.ends_at>p_starts_at) then raise exception 'availability_overlap' using errcode='23P01'; end if;
  insert into public.availability_slots(therapist_id,starts_at,ends_at,is_available,timezone) values(v_therapist,p_starts_at,p_ends_at,true,v_zone) returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.therapist_delete_availability_slot(p_slot_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid();
begin
  if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.role='therapist') then raise exception 'therapist_only' using errcode='42501'; end if;
  if exists(select 1 from public.availability_slots s join public.therapists t on t.id=s.therapist_id join public.appointments a on a.slot_id=s.id where s.id=p_slot_id and t.owner_user_id=v_user) then raise exception 'slot_has_appointment' using errcode='23503'; end if;
  delete from public.availability_slots s using public.therapists t where s.id=p_slot_id and t.id=s.therapist_id and t.owner_user_id=v_user;
  if not found then raise exception 'slot_not_found_or_not_owned' using errcode='P0002'; end if;
  return true;
end;
$function$;

revoke all on function public.admin_assign_therapist_user(uuid,uuid) from public,anon;
revoke all on function public.admin_list_availability_slots(uuid) from public,anon;
revoke all on function public.admin_create_availability_slot(uuid,timestamptz,timestamptz,text) from public,anon;
revoke all on function public.admin_delete_availability_slot(uuid) from public,anon;
revoke all on function public.therapist_list_appointments() from public,anon;
revoke all on function public.therapist_list_availability_slots() from public,anon;
revoke all on function public.therapist_create_availability_slot(timestamptz,timestamptz,text) from public,anon;
revoke all on function public.therapist_delete_availability_slot(uuid) from public,anon;
grant execute on function public.admin_assign_therapist_user(uuid,uuid) to authenticated;
grant execute on function public.admin_list_availability_slots(uuid) to authenticated;
grant execute on function public.admin_create_availability_slot(uuid,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.admin_delete_availability_slot(uuid) to authenticated;
grant execute on function public.therapist_list_appointments() to authenticated;
grant execute on function public.therapist_list_availability_slots() to authenticated;
grant execute on function public.therapist_create_availability_slot(timestamptz,timestamptz,text) to authenticated;
grant execute on function public.therapist_delete_availability_slot(uuid) to authenticated;
