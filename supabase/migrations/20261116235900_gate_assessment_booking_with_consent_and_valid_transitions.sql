alter table public.assessment_requests add column if not exists policy_version text, add column if not exists adult_confirmation boolean not null default false, add column if not exists consented_at timestamptz;
revoke all on function public.client_create_assessment_request(text,uuid,text) from public,anon,authenticated;
drop function if exists public.client_create_assessment_request(text,uuid,text);
create or replace function public.client_create_assessment_request(p_assessment_type text,p_specialist_id uuid,p_currency text,p_policy_version text,p_adult_confirmation boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_client uuid:=auth.uid();v_amount bigint;v_id uuid;v_intake boolean;v_policy text;
begin
 if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then raise exception 'client_only' using errcode='42501'; end if;
 select coalesce((s.value#>>'{}')::boolean,false) into v_intake from public.site_settings s where s.key='client_intake_enabled';
 if coalesce(v_intake,false) is not true then raise exception 'client_intake_paused' using errcode='55000'; end if;
 select coalesce(s.value#>>'{}','') into v_policy from public.site_settings s where s.key='client_policy_version';
 if v_policy='' or p_policy_version is distinct from v_policy or v_policy ilike '%draft%' or v_policy ilike '%test%' or v_policy ilike '%preview%' then raise exception 'current_policy_version_required' using errcode='22023'; end if;
 if p_adult_confirmation is distinct from true then raise exception 'adult_confirmation_required' using errcode='22023'; end if;
 if p_assessment_type not in ('STIPO','SWAP') or p_currency not in ('IRR','EUR','USD','CAD') then raise exception 'invalid_assessment_selection' using errcode='22023'; end if;
 if not exists(select 1 from public.therapists t where t.id=p_specialist_id and t.is_assessment_specialist and t.is_listed and t.verified_at is not null) then raise exception 'assessment_specialist_unavailable' using errcode='P0001'; end if;
 select amount into v_amount from public.assessment_fee_schedule where assessment_type=p_assessment_type and currency=p_currency and is_active;
 if v_amount is null then raise exception 'assessment_fee_not_configured' using errcode='P0001'; end if;
 insert into public.assessment_requests(client_id,specialist_id,assessment_type,currency,amount,policy_version,adult_confirmation,consented_at)
 values(v_client,p_specialist_id,p_assessment_type,p_currency,v_amount,v_policy,true,now()) returning id into v_id; return v_id;
end; $$;
revoke all on function public.client_create_assessment_request(text,uuid,text,text,boolean) from public,anon; grant execute on function public.client_create_assessment_request(text,uuid,text,text,boolean) to authenticated;
create or replace function public.admin_update_assessment_request(p_request_id uuid,p_status text,p_meeting_url text default null,p_meeting_password text default null,p_scheduled_at timestamptz default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin perform public.require_admin_aal2();
 if p_status not in ('payment_verified','scheduled','completed','cancelled') then raise exception 'invalid_assessment_status' using errcode='22023'; end if;
 if p_status='scheduled' and (nullif(trim(coalesce(p_meeting_url,'')),'') is null or p_scheduled_at is null) then raise exception 'meeting_link_and_time_required' using errcode='22023'; end if;
 update public.assessment_requests set status=p_status,meeting_url=case when p_status='scheduled' then trim(p_meeting_url) else meeting_url end,
 meeting_password=case when p_status='scheduled' then nullif(trim(p_meeting_password),'') else meeting_password end,
 scheduled_at=case when p_status='scheduled' then p_scheduled_at else scheduled_at end,updated_at=now()
 where id=p_request_id and ((p_status='payment_verified' and status='payment_submitted') or (p_status='scheduled' and status='payment_verified') or (p_status='completed' and status='scheduled') or (p_status='cancelled' and status not in ('completed','cancelled')));
 if not found then raise exception 'assessment_status_transition_not_allowed' using errcode='55000'; end if; return true;
end; $$;
revoke all on function public.admin_update_assessment_request(uuid,text,text,text,timestamptz) from public,anon; grant execute on function public.admin_update_assessment_request(uuid,text,text,text,timestamptz) to authenticated;