-- Private client notifications for confirmed appointments and newly available meeting links.
create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('appointment','session_access','support')),
  title text not null check (length(title) between 1 and 180),
  body text not null check (length(body) between 1 and 1200),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists client_notifications_inbox_idx on public.client_notifications(client_id,created_at desc);
alter table public.client_notifications enable row level security;
revoke all on public.client_notifications from public,anon,authenticated;

create or replace function public.client_list_notifications()
returns table(notification_id uuid,category text,title text,body text,read_at timestamptz,created_at timestamptz)
language plpgsql stable security definer set search_path=''
as $function$
declare v_client uuid:=auth.uid();
begin
  if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  return query select n.id,n.category,n.title,n.body,n.read_at,n.created_at
    from public.client_notifications n where n.client_id=v_client order by n.created_at desc limit 100;
end;
$function$;

create or replace function public.client_mark_notification_read(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_client uuid:=auth.uid();
begin
  if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  update public.client_notifications set read_at=coalesce(read_at,now())
  where id=p_notification_id and client_id=v_client;
  if not found then raise exception 'notification_not_found' using errcode='P0002'; end if;
  return true;
end;
$function$;

create or replace function public.notify_client_appointment_confirmed()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if tg_op='INSERT' then
    if new.status::text='confirmed' then
      insert into public.client_notifications(client_id,category,title,body)
      values(new.client_id,'appointment','زمان جلسه تأیید شد','زمان جلسهٔ شما ثبت شده است. جزئیات و لینک خصوصی، پس از ثبت لینک توسط مدیریت، در پنل مراجع نمایش داده می‌شود.');
    end if;
  elsif new.status::text='confirmed' and old.status::text is distinct from new.status::text then
    insert into public.client_notifications(client_id,category,title,body)
    values(new.client_id,'appointment','زمان جلسه تأیید شد','زمان جلسهٔ شما ثبت شده است. جزئیات و لینک خصوصی، پس از ثبت لینک توسط مدیریت، در پنل مراجع نمایش داده می‌شود.');
  end if;
  return new;
end;
$function$;

create or replace function public.notify_client_meeting_access_ready()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_client uuid;
begin
  if tg_op='INSERT' then
    select a.client_id into v_client from public.appointments a where a.id=new.appointment_id;
  elsif old.meeting_url is distinct from new.meeting_url then
    select a.client_id into v_client from public.appointments a where a.id=new.appointment_id;
  end if;
  if v_client is not null then
    insert into public.client_notifications(client_id,category,title,body)
    values(v_client,'session_access','لینک جلسه آماده است','لینک ورود به جلسهٔ خصوصی در بخش «جلسات من» پنل شما قرار گرفته است.');
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_notify_client_appointment_confirmed on public.appointments;
create trigger trg_notify_client_appointment_confirmed
after insert or update of status on public.appointments
for each row execute function public.notify_client_appointment_confirmed();
drop trigger if exists trg_notify_client_meeting_access_ready on public.appointment_private_access;
create trigger trg_notify_client_meeting_access_ready
after insert or update of meeting_url,meeting_password on public.appointment_private_access
for each row execute function public.notify_client_meeting_access_ready();

revoke all on function public.client_list_notifications() from public,anon;
revoke all on function public.client_mark_notification_read(uuid) from public,anon;
revoke all on function public.notify_client_appointment_confirmed() from public,anon,authenticated;
revoke all on function public.notify_client_meeting_access_ready() from public,anon,authenticated;
grant execute on function public.client_list_notifications() to authenticated;
grant execute on function public.client_mark_notification_read(uuid) to authenticated;
