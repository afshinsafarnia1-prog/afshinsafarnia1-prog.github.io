-- Private client support inbox with ownership checks and AAL2-only administration.
create table if not exists public.client_support_tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid references public.client_requests(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  ticket_type text not null check (ticket_type in ('cancellation','reschedule','complaint','therapist_change','data_request','account_deletion','other')),
  message text not null check (length(message) between 8 and 2000),
  status text not null default 'new' check (status in ('new','in_review','resolved','declined')),
  admin_note text check (admin_note is null or length(admin_note)<=2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_support_tickets_client_idx on public.client_support_tickets(client_id,created_at desc);
create index if not exists client_support_tickets_status_idx on public.client_support_tickets(status,created_at desc);
alter table public.client_support_tickets enable row level security;
revoke all on public.client_support_tickets from public,anon,authenticated;

create or replace function public.client_submit_support_ticket(
  p_ticket_type text,p_message text,p_request_id uuid default null,p_appointment_id uuid default null
)
returns uuid language plpgsql security definer set search_path=''
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
  if p_ticket_type in ('cancellation','reschedule','complaint','therapist_change') and p_request_id is null and p_appointment_id is null then
    raise exception 'request_or_appointment_required' using errcode='22023';
  end if;
  if (select count(*) from public.client_support_tickets s where s.client_id=v_client and s.created_at>now()-interval '1 day')>=10 then
    raise exception 'support_rate_limit' using errcode='P0001';
  end if;
  insert into public.client_support_tickets(client_id,request_id,appointment_id,ticket_type,message)
  values(v_client,p_request_id,p_appointment_id,p_ticket_type,trim(p_message)) returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.client_list_support_tickets()
returns table(ticket_id uuid,ticket_type text,message text,status text,admin_note text,created_at timestamptz,request_id uuid,appointment_id uuid)
language plpgsql stable security definer set search_path=''
as $function$
declare v_client uuid:=auth.uid();
begin
  if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  return query select s.id,s.ticket_type,s.message,s.status,s.admin_note,s.created_at,s.request_id,s.appointment_id
    from public.client_support_tickets s where s.client_id=v_client order by s.created_at desc;
end;
$function$;

create or replace function public.admin_list_support_tickets(p_limit integer default 100)
returns table(ticket_id uuid,client_name text,ticket_type text,message text,status text,admin_note text,created_at timestamptz,request_id uuid,appointment_id uuid)
language plpgsql stable security definer set search_path=''
as $function$
begin
  perform public.require_admin_aal2();
  return query select s.id,coalesce(p.display_name,'مراجع'),s.ticket_type,s.message,s.status,s.admin_note,s.created_at,s.request_id,s.appointment_id
    from public.client_support_tickets s join public.profiles p on p.id=s.client_id
    order by case when s.status='new' then 0 else 1 end,s.created_at desc
    limit greatest(1,least(coalesce(p_limit,100),200));
end;
$function$;

create or replace function public.admin_update_support_ticket(p_ticket_id uuid,p_status text,p_admin_note text default null)
returns boolean language plpgsql security definer set search_path=''
as $function$
begin
  perform public.require_admin_aal2();
  if p_status not in ('new','in_review','resolved','declined') then raise exception 'invalid_ticket_status' using errcode='22023'; end if;
  if p_admin_note is not null and length(p_admin_note)>2000 then raise exception 'admin_note_too_long' using errcode='22023'; end if;
  update public.client_support_tickets
  set status=p_status,admin_note=nullif(trim(coalesce(p_admin_note,'')),''),updated_at=now()
  where id=p_ticket_id and ticket_type not in ('cancellation','reschedule','therapist_change');
  if not found then raise exception 'ticket_not_found_or_requires_dedicated_workflow' using errcode='P0002'; end if;
  return true;
end;
$function$;

revoke all on function public.client_submit_support_ticket(text,text,uuid,uuid) from public,anon;
revoke all on function public.client_list_support_tickets() from public,anon;
revoke all on function public.admin_list_support_tickets(integer) from public,anon;
revoke all on function public.admin_update_support_ticket(uuid,text,text) from public,anon;
grant execute on function public.client_submit_support_ticket(text,text,uuid,uuid) to authenticated;
grant execute on function public.client_list_support_tickets() to authenticated;
grant execute on function public.admin_list_support_tickets(integer) to authenticated;
grant execute on function public.admin_update_support_ticket(uuid,text,text) to authenticated;
