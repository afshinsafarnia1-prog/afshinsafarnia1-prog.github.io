-- Keep meeting credentials private and expose them only to the owning client
-- after payment and appointment confirmation. Admin operations require AAL2.
create table if not exists public.appointment_private_access (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  meeting_url text not null,
  meeting_password text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_private_access_https_url check (
    meeting_url ~ '^https://[^[:space:]/]+' and length(meeting_url) <= 1000
  ),
  constraint appointment_private_access_password_length check (
    meeting_password is null or length(meeting_password) <= 160
  )
);
alter table public.appointment_private_access enable row level security;
revoke all on public.appointment_private_access from public, anon, authenticated;

create or replace function public.admin_list_appointment_private_access()
returns table(
  appointment_id uuid, client_name text, therapist_name text,
  starts_at timestamptz, ends_at timestamptz, timezone text,
  appointment_status public.appointment_status, meeting_url text, meeting_password text
)
language plpgsql stable security definer set search_path=''
as $function$
begin
  perform public.require_admin_aal2();
  return query
  select a.id, coalesce(p.display_name,'مراجع'), t.display_name,
         a.starts_at, a.ends_at, a.timezone, a.status,
         pa.meeting_url, pa.meeting_password
  from public.appointments a
  join public.therapists t on t.id=a.therapist_id
  left join public.profiles p on p.id=a.client_id
  left join public.appointment_private_access pa on pa.appointment_id=a.id
  where a.status::text='confirmed'
    and exists (
      select 1 from public.payments pay
      where pay.appointment_id=a.id and pay.client_id=a.client_id
        and pay.status::text='paid'
    )
  order by a.starts_at asc;
end;
$function$;

create or replace function public.admin_set_appointment_meeting(
  p_appointment_id uuid, p_meeting_url text, p_meeting_password text default null
)
returns void
language plpgsql security definer set search_path=''
as $function$
declare
  v_admin uuid:=auth.uid();
  v_url text:=btrim(coalesce(p_meeting_url,''));
  v_password text:=nullif(btrim(coalesce(p_meeting_password,'')),'');
begin
  perform public.require_admin_aal2();
  if v_admin is null then raise exception 'admin_only' using errcode='42501'; end if;
  if p_appointment_id is null then raise exception 'appointment_required' using errcode='22023'; end if;
  if v_url !~ '^https://[^[:space:]/]+' or length(v_url)>1000 then
    raise exception 'valid_https_meeting_url_required' using errcode='22023';
  end if;
  if v_password is not null and length(v_password)>160 then
    raise exception 'meeting_password_too_long' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.appointments a
    where a.id=p_appointment_id and a.status::text='confirmed'
      and exists (
        select 1 from public.payments pay
        where pay.appointment_id=a.id and pay.client_id=a.client_id
          and pay.status::text='paid'
      )
  ) then
    raise exception 'confirmed_paid_appointment_required' using errcode='23514';
  end if;
  insert into public.appointment_private_access(
    appointment_id,meeting_url,meeting_password,created_by,created_at,updated_at
  ) values (p_appointment_id,v_url,v_password,v_admin,now(),now())
  on conflict (appointment_id) do update set
    meeting_url=excluded.meeting_url, meeting_password=excluded.meeting_password,
    created_by=excluded.created_by, updated_at=now();
end;
$function$;

create or replace function public.client_list_appointments()
returns table(
  appointment_id uuid, therapist_name text, starts_at timestamptz, ends_at timestamptz,
  timezone text, appointment_status public.appointment_status,
  meeting_url text, meeting_password text, can_leave_feedback boolean
)
language plpgsql stable security definer set search_path=''
as $function$
declare v_client uuid:=auth.uid();
begin
  if v_client is null or not exists(
    select 1 from public.profiles p where p.id=v_client and p.role='client'
  ) then raise exception 'client_only' using errcode='42501'; end if;
  return query
  select a.id,t.display_name,a.starts_at,a.ends_at,a.timezone,a.status,
    case when a.status::text='confirmed' and exists(
      select 1 from public.payments pay
      where pay.appointment_id=a.id and pay.client_id=v_client and pay.status::text='paid'
    ) then pa.meeting_url else null::text end,
    case when a.status::text='confirmed' and exists(
      select 1 from public.payments pay
      where pay.appointment_id=a.id and pay.client_id=v_client and pay.status::text='paid'
    ) then pa.meeting_password else null::text end,
    (a.status::text='completed'
      and exists(select 1 from public.payments pay
        where pay.appointment_id=a.id and pay.client_id=v_client and pay.status::text='paid')
      and not exists(select 1 from public.client_appointment_feedback f where f.appointment_id=a.id))
  from public.appointments a
  join public.therapists t on t.id=a.therapist_id
  left join public.appointment_private_access pa on pa.appointment_id=a.id
  where a.client_id=v_client
  order by a.starts_at desc;
end;
$function$;

revoke all on function public.admin_list_appointment_private_access() from public,anon;
revoke all on function public.admin_set_appointment_meeting(uuid,text,text) from public,anon;
revoke all on function public.client_list_appointments() from public,anon;
grant execute on function public.admin_list_appointment_private_access() to authenticated;
grant execute on function public.admin_set_appointment_meeting(uuid,text,text) to authenticated;
grant execute on function public.client_list_appointments() to authenticated;
