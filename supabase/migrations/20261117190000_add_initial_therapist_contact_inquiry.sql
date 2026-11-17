-- Allow authenticated clients to request an initial, non-booking contact about a publicly listed therapist.
-- This does not create an appointment, accept a client for treatment, or initiate payment.

create or replace function public.client_submit_therapist_inquiry(
  p_therapist_id uuid,
  p_contact_method text,
  p_contact_value text,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_client uuid := auth.uid();
  v_therapist_name text;
  v_ticket_id uuid;
  v_contact text := btrim(coalesce(p_contact_value, ''));
  v_message text := btrim(coalesce(p_message, ''));
begin
  if v_client is null or not exists (
    select 1 from public.profiles p where p.id = v_client and p.role = 'client'
  ) then
    raise exception 'client_only' using errcode = '42501';
  end if;

  select t.display_name into v_therapist_name
  from public.therapists t
  where t.id = p_therapist_id
    and t.is_listed = true
    and (t.verified_at is not null or t.manager_approved = true);

  if v_therapist_name is null then
    raise exception 'therapist_not_available' using errcode = 'P0002';
  end if;

  if p_contact_method not in ('phone', 'email') or char_length(v_contact) < 5 or char_length(v_contact) > 254 then
    raise exception 'invalid_contact' using errcode = '22023';
  end if;
  if p_contact_method = 'email' and v_contact !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid_contact' using errcode = '22023';
  end if;
  if p_contact_method = 'phone' and (
    v_contact !~ '^[+0-9() .-]{7,25}$'
    or char_length(regexp_replace(v_contact, '[^0-9]', '', 'g')) < 7
  ) then
    raise exception 'invalid_contact' using errcode = '22023';
  end if;
  if char_length(v_message) > 500 then
    raise exception 'invalid_message_length' using errcode = '22023';
  end if;

  if (
    select count(*) from public.client_support_tickets s
    where s.client_id = v_client
      and s.ticket_type = 'therapist_inquiry'
      and s.created_at > now() - interval '1 day'
  ) >= 5 then
    raise exception 'inquiry_rate_limit' using errcode = 'P0001';
  end if;

  insert into public.client_support_tickets (client_id, ticket_type, message)
  values (
    v_client,
    'therapist_inquiry',
    'درمانگر موردنظر: ' || v_therapist_name || ' (' || p_therapist_id::text || ')' ||
    E'\nراه تماس ترجیحی: ' || case when p_contact_method = 'phone' then 'تلفن' else 'ایمیل' end ||
    E'\nاطلاعات تماس: ' || v_contact ||
    case when v_message <> '' then E'\nپیام مراجع: ' || v_message else '' end
  )
  returning id into v_ticket_id;

  return v_ticket_id;
end;
$function$;

revoke all on function public.client_submit_therapist_inquiry(uuid, text, text, text) from public, anon;
grant execute on function public.client_submit_therapist_inquiry(uuid, text, text, text) to authenticated;
