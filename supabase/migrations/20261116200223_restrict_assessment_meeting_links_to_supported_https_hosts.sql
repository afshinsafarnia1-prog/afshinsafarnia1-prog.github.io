create or replace function public.admin_update_assessment_request(p_request_id uuid,p_status text,p_meeting_url text default null,p_meeting_password text default null,p_scheduled_at timestamptz default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform public.require_admin_aal2();
 if p_status not in ('payment_verified','scheduled','completed','cancelled') then raise exception 'invalid_assessment_status' using errcode='22023'; end if;
 if p_status='scheduled' then
  if nullif(trim(coalesce(p_meeting_url,'')),'') is null or p_scheduled_at is null or p_scheduled_at<=now() then raise exception 'future_meeting_time_and_link_required' using errcode='22023'; end if;
  if p_meeting_url !~* '^https://([a-z0-9-]+\.)?zoom\.us/' and p_meeting_url !~* '^https://meet\.google\.com/' then raise exception 'meeting_link_must_be_zoom_or_google_meet_https' using errcode='22023'; end if;
  if length(coalesce(p_meeting_password,''))>120 then raise exception 'meeting_password_too_long' using errcode='22023'; end if;
 end if;
 update public.assessment_requests set status=p_status,meeting_url=case when p_status='scheduled' then trim(p_meeting_url) else meeting_url end,
 meeting_password=case when p_status='scheduled' then nullif(trim(p_meeting_password),'') else meeting_password end,
 scheduled_at=case when p_status='scheduled' then p_scheduled_at else scheduled_at end,updated_at=now()
 where id=p_request_id and ((p_status='payment_verified' and status='payment_submitted') or (p_status='scheduled' and status='payment_verified') or (p_status='completed' and status='scheduled') or (p_status='cancelled' and status not in ('completed','cancelled')));
 if not found then raise exception 'assessment_status_transition_not_allowed' using errcode='55000'; end if; return true;
end; $$;
revoke all on function public.admin_update_assessment_request(uuid,text,text,text,timestamptz) from public,anon;
grant execute on function public.admin_update_assessment_request(uuid,text,text,text,timestamptz) to authenticated;