-- Complete the admin availability-slot selection flow for verified, paid client requests.
create or replace function public.admin_list_available_slots_for_request(p_request_id uuid)
returns table(slot_id uuid,starts_at timestamptz,ends_at timestamptz,timezone text,client_timezone text)
language plpgsql stable security definer set search_path=''
as $function$
declare v_request public.client_requests%rowtype;
begin
  perform public.require_admin_aal2();
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then
    raise exception 'admin_only' using errcode='42501';
  end if;
  select * into v_request from public.client_requests r where r.id=p_request_id and r.status='payment_verified';
  if not found then raise exception 'request_not_ready_to_schedule' using errcode='P0001'; end if;
  if not exists(select 1 from public.payments p where p.request_id=p_request_id and p.status='paid') then
    raise exception 'payment_not_verified' using errcode='P0001';
  end if;
  return query
  select s.id,s.starts_at,s.ends_at,s.timezone,coalesce(nullif(p.timezone,''),s.timezone,'Asia/Tehran')
  from public.availability_slots s
  join public.profiles p on p.id=v_request.client_id
  join public.therapists t on t.id=s.therapist_id
  where s.therapist_id=v_request.therapist_id and s.is_available=true and s.starts_at>now()
    and t.is_listed and t.verified_at is not null
    and not exists(select 1 from public.appointments a where a.therapist_id=s.therapist_id
      and a.status in ('requested','confirmed') and a.starts_at<s.ends_at and a.ends_at>s.starts_at)
  order by s.starts_at;
end;
$function$;

create or replace function public.admin_schedule_request_from_slot(p_request_id uuid,p_slot_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare
  v_admin uuid:=auth.uid(); v_request public.client_requests%rowtype;
  v_slot public.availability_slots%rowtype; v_appointment uuid; v_client_timezone text;
begin
  perform public.require_admin_aal2();
  if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
    raise exception 'admin_only' using errcode='42501';
  end if;
  select * into v_request from public.client_requests r where r.id=p_request_id and r.status='payment_verified' for update;
  if not found then raise exception 'request_not_ready_to_schedule' using errcode='P0001'; end if;
  if not exists(select 1 from public.payments p where p.request_id=p_request_id and p.status='paid') then
    raise exception 'payment_not_verified' using errcode='P0001';
  end if;
  select * into v_slot from public.availability_slots s where s.id=p_slot_id
    and s.therapist_id=v_request.therapist_id and s.is_available=true and s.starts_at>now() for update;
  if not found then raise exception 'slot_unavailable' using errcode='P0001'; end if;
  if not exists(select 1 from public.therapists t where t.id=v_request.therapist_id and t.is_listed and t.verified_at is not null) then
    raise exception 'therapist_no_longer_available' using errcode='P0001';
  end if;
  if exists(select 1 from public.appointments a where a.therapist_id=v_slot.therapist_id
    and a.status in ('requested','confirmed') and a.starts_at<v_slot.ends_at and a.ends_at>v_slot.starts_at) then
    raise exception 'slot_conflict' using errcode='P0001';
  end if;
  select coalesce(nullif(p.timezone,''),v_slot.timezone,'Asia/Tehran') into v_client_timezone
  from public.profiles p where p.id=v_request.client_id;
  insert into public.appointments(client_id,therapist_id,slot_id,starts_at,ends_at,status,client_message,market,timezone)
  values(v_request.client_id,v_request.therapist_id,v_slot.id,v_slot.starts_at,v_slot.ends_at,
    'confirmed',v_request.client_message,v_request.market,coalesce(v_client_timezone,'Asia/Tehran'))
  returning id into v_appointment;
  update public.availability_slots set is_available=false where id=v_slot.id;
  update public.client_requests set status='scheduled',appointment_id=v_appointment,updated_at=now() where id=p_request_id;
  update public.payments set appointment_id=v_appointment where request_id=p_request_id and status='paid';
  return v_appointment;
end;
$function$;

revoke all on function public.admin_list_available_slots_for_request(uuid) from public,anon;
revoke all on function public.admin_schedule_request_from_slot(uuid,uuid) from public,anon;
grant execute on function public.admin_list_available_slots_for_request(uuid) to authenticated;
grant execute on function public.admin_schedule_request_from_slot(uuid,uuid) to authenticated;
