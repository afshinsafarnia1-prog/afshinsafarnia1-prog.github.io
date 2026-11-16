alter table public.therapists add column if not exists is_assessment_specialist boolean not null default false;
create table if not exists public.assessment_fee_schedule (
 id uuid primary key default gen_random_uuid(), assessment_type text not null check(assessment_type in ('STIPO','SWAP')),
 currency text not null check(currency in ('IRR','EUR','USD','CAD')), amount bigint not null check(amount>0),
 is_active boolean not null default true, updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
 unique(assessment_type,currency)
);
alter table public.assessment_fee_schedule enable row level security;
revoke all on public.assessment_fee_schedule from anon,authenticated;
create table if not exists public.assessment_requests (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references auth.users(id),
 specialist_id uuid not null references public.therapists(id), assessment_type text not null check(assessment_type in ('STIPO','SWAP')),
 currency text not null check(currency in ('IRR','EUR','USD','CAD')), amount bigint not null check(amount>0),
 status text not null default 'awaiting_payment' check(status in ('awaiting_payment','payment_submitted','payment_verified','scheduled','completed','cancelled')),
 payment_reference text, meeting_url text, meeting_password text, scheduled_at timestamptz, recommendations text,
 recommended_therapist_ids uuid[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.assessment_requests enable row level security;
revoke all on public.assessment_requests from anon,authenticated;
create index if not exists assessment_requests_client_created_idx on public.assessment_requests(client_id,created_at desc);
create index if not exists assessment_requests_specialist_status_idx on public.assessment_requests(specialist_id,status);

create or replace function public.admin_set_assessment_specialist(p_therapist_id uuid,p_enabled boolean) returns boolean language plpgsql security definer set search_path='' as $$
begin perform public.require_admin_aal2();
 if p_enabled and not exists(select 1 from public.therapists t where t.id=p_therapist_id and t.is_listed and t.verified_at is not null) then raise exception 'assessment_specialist_must_be_verified_and_listed' using errcode='55000'; end if;
 update public.therapists set is_assessment_specialist=p_enabled,updated_at=now() where id=p_therapist_id;
 if not found then raise exception 'therapist_not_found' using errcode='P0002'; end if; return true;
end; $$;
revoke all on function public.admin_set_assessment_specialist(uuid,boolean) from public,anon;
grant execute on function public.admin_set_assessment_specialist(uuid,boolean) to authenticated;

create or replace function public.admin_set_assessment_fee(p_assessment_type text,p_currency text,p_amount bigint,p_active boolean default true) returns boolean language plpgsql security definer set search_path='' as $$
begin perform public.require_admin_aal2();
 if p_assessment_type not in ('STIPO','SWAP') or p_currency not in ('IRR','EUR','USD','CAD') or p_amount is null or p_amount<=0 then raise exception 'invalid_assessment_fee' using errcode='22023'; end if;
 insert into public.assessment_fee_schedule(assessment_type,currency,amount,is_active,updated_by,updated_at) values(p_assessment_type,p_currency,p_amount,coalesce(p_active,true),auth.uid(),now())
 on conflict(assessment_type,currency) do update set amount=excluded.amount,is_active=excluded.is_active,updated_by=auth.uid(),updated_at=now(); return true;
end; $$;
revoke all on function public.admin_set_assessment_fee(text,text,bigint,boolean) from public,anon;
grant execute on function public.admin_set_assessment_fee(text,text,bigint,boolean) to authenticated;

create or replace function public.get_public_assessment_catalog() returns table(specialist_id uuid,specialist_name text,headline text,public_slug text,assessment_type text,currency text,amount bigint) language sql stable security definer set search_path='' as $$
 select t.id,t.display_name,t.headline,t.public_slug,f.assessment_type,f.currency,f.amount from public.therapists t cross join public.assessment_fee_schedule f
 where t.is_assessment_specialist and t.is_listed and t.verified_at is not null and f.is_active order by t.display_name,f.assessment_type,f.currency;
$$;
revoke all on function public.get_public_assessment_catalog() from public;
grant execute on function public.get_public_assessment_catalog() to anon,authenticated;

create or replace function public.client_create_assessment_request(p_assessment_type text,p_specialist_id uuid,p_currency text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_client uuid:=auth.uid(); v_amount bigint; v_id uuid;
begin
 if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then raise exception 'client_only' using errcode='42501'; end if;
 if p_assessment_type not in ('STIPO','SWAP') or p_currency not in ('IRR','EUR','USD','CAD') then raise exception 'invalid_assessment_selection' using errcode='22023'; end if;
 if not exists(select 1 from public.therapists t where t.id=p_specialist_id and t.is_assessment_specialist and t.is_listed and t.verified_at is not null) then raise exception 'assessment_specialist_unavailable' using errcode='P0001'; end if;
 select amount into v_amount from public.assessment_fee_schedule where assessment_type=p_assessment_type and currency=p_currency and is_active;
 if v_amount is null then raise exception 'assessment_fee_not_configured' using errcode='P0001'; end if;
 insert into public.assessment_requests(client_id,specialist_id,assessment_type,currency,amount) values(v_client,p_specialist_id,p_assessment_type,p_currency,v_amount) returning id into v_id; return v_id;
end; $$;
revoke all on function public.client_create_assessment_request(text,uuid,text) from public,anon;
grant execute on function public.client_create_assessment_request(text,uuid,text) to authenticated;

create or replace function public.client_submit_assessment_payment_reference(p_request_id uuid,p_reference text) returns boolean language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if length(trim(coalesce(p_reference,'')))<4 or length(trim(p_reference))>120 then raise exception 'invalid_payment_reference' using errcode='22023'; end if;
 update public.assessment_requests set payment_reference=trim(p_reference),status='payment_submitted',updated_at=now() where id=p_request_id and client_id=auth.uid() and status='awaiting_payment';
 if not found then raise exception 'assessment_request_not_found_or_not_payable' using errcode='P0002'; end if; return true;
end; $$;
revoke all on function public.client_submit_assessment_payment_reference(uuid,text) from public,anon;
grant execute on function public.client_submit_assessment_payment_reference(uuid,text) to authenticated;

create or replace function public.client_list_assessment_requests() returns table(request_id uuid,assessment_type text,specialist_name text,amount bigint,currency text,status text,payment_reference text,scheduled_at timestamptz,meeting_url text,meeting_password text,recommendations text,recommended_therapist_ids uuid[],created_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 return query select r.id,r.assessment_type,t.display_name,r.amount,r.currency,r.status,r.payment_reference,r.scheduled_at,
 case when r.status in ('scheduled','completed') then r.meeting_url else null end,
 case when r.status in ('scheduled','completed') then r.meeting_password else null end,
 case when r.status='completed' then r.recommendations else null end,
 case when r.status='completed' then r.recommended_therapist_ids else '{}'::uuid[] end,r.created_at
 from public.assessment_requests r join public.therapists t on t.id=r.specialist_id where r.client_id=auth.uid() order by r.created_at desc;
end; $$;
revoke all on function public.client_list_assessment_requests() from public,anon;
grant execute on function public.client_list_assessment_requests() to authenticated;

create or replace function public.admin_list_assessment_requests() returns table(request_id uuid,client_name text,specialist_id uuid,specialist_name text,assessment_type text,amount bigint,currency text,status text,payment_reference text,scheduled_at timestamptz,created_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform public.require_admin_aal2();
 return query select r.id,coalesce(p.display_name,'مراجع'),r.specialist_id,t.display_name,r.assessment_type,r.amount,r.currency,r.status,r.payment_reference,r.scheduled_at,r.created_at
 from public.assessment_requests r join public.therapists t on t.id=r.specialist_id left join public.profiles p on p.id=r.client_id order by r.created_at desc;
end; $$;
revoke all on function public.admin_list_assessment_requests() from public,anon;
grant execute on function public.admin_list_assessment_requests() to authenticated;

create or replace function public.admin_update_assessment_request(p_request_id uuid,p_status text,p_meeting_url text default null,p_meeting_password text default null,p_scheduled_at timestamptz default null) returns boolean language plpgsql security definer set search_path='' as $$
begin perform public.require_admin_aal2();
 if p_status not in ('payment_verified','scheduled','completed','cancelled') then raise exception 'invalid_assessment_status' using errcode='22023'; end if;
 if p_status='scheduled' and (nullif(trim(coalesce(p_meeting_url,'')),'') is null or p_scheduled_at is null) then raise exception 'meeting_link_and_time_required' using errcode='22023'; end if;
 update public.assessment_requests set status=p_status,meeting_url=case when p_status='scheduled' then trim(p_meeting_url) else meeting_url end,
 meeting_password=case when p_status='scheduled' then nullif(trim(p_meeting_password),'') else meeting_password end,
 scheduled_at=case when p_status='scheduled' then p_scheduled_at else scheduled_at end,updated_at=now()
 where id=p_request_id and (p_status<>'scheduled' or status='payment_verified') and (p_status<>'payment_verified' or status='payment_submitted');
 if not found then raise exception 'assessment_status_transition_not_allowed' using errcode='55000'; end if; return true;
end; $$;
revoke all on function public.admin_update_assessment_request(uuid,text,text,text,timestamptz) from public,anon;
grant execute on function public.admin_update_assessment_request(uuid,text,text,text,timestamptz) to authenticated;

create or replace function public.assessment_specialist_add_recommendations(p_request_id uuid,p_recommendations text,p_recommended_therapist_ids uuid[]) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='therapist') then raise exception 'therapist_only' using errcode='42501'; end if;
 if length(trim(coalesce(p_recommendations,'')))<10 or length(p_recommendations)>5000 then raise exception 'recommendation_text_required' using errcode='22023'; end if;
 if exists(select 1 from unnest(coalesce(p_recommended_therapist_ids,'{}'::uuid[])) x(id) where not exists(select 1 from public.therapists t where t.id=x.id and t.is_listed and t.verified_at is not null)) then raise exception 'recommended_therapist_must_be_verified_and_listed' using errcode='22023'; end if;
 update public.assessment_requests r set recommendations=trim(p_recommendations),recommended_therapist_ids=coalesce(p_recommended_therapist_ids,'{}'::uuid[]),updated_at=now()
 from public.therapists s where r.id=p_request_id and r.specialist_id=s.id and s.owner_user_id=auth.uid() and r.status in ('scheduled','completed');
 if not found then raise exception 'assigned_assessment_request_not_found' using errcode='P0002'; end if; return true;
end; $$;
revoke all on function public.assessment_specialist_add_recommendations(uuid,text,uuid[]) from public,anon;
grant execute on function public.assessment_specialist_add_recommendations(uuid,text,uuid[]) to authenticated;