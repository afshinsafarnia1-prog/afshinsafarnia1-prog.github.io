-- Moderated appointment feedback and public read-only summaries.
-- Private feedback rows are accessible only through guarded RPC functions.
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
create index if not exists client_feedback_therapist_public_idx
  on public.client_appointment_feedback(therapist_id,created_at desc)
  where status='published';
alter table public.client_appointment_feedback enable row level security;
revoke all on public.client_appointment_feedback from public,anon,authenticated;

create or replace function public.client_submit_appointment_feedback(
  p_appointment_id uuid,p_rating integer,p_feedback text default null
)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_client uuid:=auth.uid(); v_therapist uuid; v_id uuid;
begin
  if v_client is null or not exists(
    select 1 from public.profiles p where p.id=v_client and p.role='client'
  ) then raise exception 'client_only' using errcode='42501'; end if;
  if p_rating is null or p_rating not between 1 and 5
     or (p_feedback is not null and length(p_feedback)>1500) then
    raise exception 'invalid_feedback' using errcode='22023';
  end if;
  select a.therapist_id into v_therapist
  from public.appointments a
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
language plpgsql security definer set search_path=''
as $function$
declare v_limit integer:=least(greatest(coalesce(p_limit,100),1),200);
begin
  perform public.require_admin_aal2();
  return query select f.id,t.display_name,f.rating,f.feedback,f.status,f.created_at
  from public.client_appointment_feedback f join public.therapists t on t.id=f.therapist_id
  order by case f.status when 'pending' then 0 when 'published' then 1 else 2 end,f.created_at desc
  limit v_limit;
end;
$function$;

create or replace function public.admin_moderate_appointment_feedback(p_feedback_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_admin uuid:=auth.uid();
begin
  perform public.require_admin_aal2();
  if p_status not in ('published','hidden') then
    raise exception 'invalid_feedback_status' using errcode='22023';
  end if;
  update public.client_appointment_feedback
  set status=p_status,reviewed_by=v_admin,updated_at=now() where id=p_feedback_id;
  if not found then raise exception 'feedback_not_found' using errcode='P0002'; end if;
  return true;
end;
$function$;

create or replace function public.get_public_therapist_rating_summary()
returns table(therapist_id uuid,average_rating numeric,review_count bigint)
language sql stable security definer set search_path=''
as $function$
  select f.therapist_id,round(avg(f.rating)::numeric,1),count(*)::bigint
  from public.client_appointment_feedback f
  join public.therapists t on t.id=f.therapist_id and t.is_listed and t.verified_at is not null
  where f.status='published' group by f.therapist_id;
$function$;

create or replace function public.get_public_therapist_feedback(p_therapist_id uuid)
returns table(rating integer,feedback text,created_at timestamptz)
language sql stable security definer set search_path=''
as $function$
  select f.rating,f.feedback,f.created_at
  from public.client_appointment_feedback f
  join public.therapists t on t.id=f.therapist_id and t.is_listed and t.verified_at is not null
  where f.therapist_id=p_therapist_id and f.status='published'
  order by f.created_at desc limit 20;
$function$;

revoke all on function public.client_submit_appointment_feedback(uuid,integer,text) from public,anon;
revoke all on function public.admin_list_appointment_feedback(integer) from public,anon;
revoke all on function public.admin_moderate_appointment_feedback(uuid,text) from public,anon;
revoke all on function public.get_public_therapist_rating_summary() from public;
revoke all on function public.get_public_therapist_feedback(uuid) from public;
grant execute on function public.client_submit_appointment_feedback(uuid,integer,text) to authenticated;
grant execute on function public.admin_list_appointment_feedback(integer) to authenticated;
grant execute on function public.admin_moderate_appointment_feedback(uuid,text) to authenticated;
grant execute on function public.get_public_therapist_rating_summary() to anon,authenticated;
grant execute on function public.get_public_therapist_feedback(uuid) to anon,authenticated;
