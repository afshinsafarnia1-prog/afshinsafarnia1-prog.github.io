-- Return only the signed-in client's own appointment metadata.
-- Meeting credentials remain unavailable until the private-access workflow is deployed.
create or replace function public.client_list_appointments()
returns table(
  appointment_id uuid,
  therapist_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  appointment_status public.appointment_status,
  meeting_url text,
  meeting_password text,
  can_leave_feedback boolean
)
language plpgsql
stable
security definer
set search_path=''
as $function$
declare v_client uuid:=auth.uid();
begin
  if v_client is null or not exists(
    select 1 from public.profiles p where p.id=v_client and p.role='client'
  ) then
    raise exception 'client_only' using errcode='42501';
  end if;
  return query
  select a.id,t.display_name,a.starts_at,a.ends_at,a.timezone,a.status,
    null::text,null::text,
    (
      a.status='completed'
      and exists(
        select 1 from public.payments pay
        where pay.appointment_id=a.id and pay.client_id=v_client and pay.status='paid'
      )
      and not exists(
        select 1 from public.client_appointment_feedback f where f.appointment_id=a.id
      )
    )
  from public.appointments a
  join public.therapists t on t.id=a.therapist_id
  where a.client_id=v_client
  order by a.starts_at desc;
end;
$function$;

revoke all on function public.client_list_appointments() from public,anon;
grant execute on function public.client_list_appointments() to authenticated;
