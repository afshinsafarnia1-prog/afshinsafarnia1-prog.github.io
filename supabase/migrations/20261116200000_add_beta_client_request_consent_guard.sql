-- Beta-only consent capture. This draft policy version must be replaced after legal review
-- before any public clinical service is launched.
create table if not exists public.client_policy_consents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  policy_version text not null,
  adult_confirmation boolean not null check (adult_confirmation),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  timezone text not null check (length(timezone) between 1 and 80),
  market text not null check (market in ('iran','international')),
  currency text not null check (currency in ('IRR','EUR','USD')),
  accepted_at timestamptz not null default now(),
  request_id uuid references public.client_requests(id) on delete set null
);
create index if not exists client_policy_consents_client_idx on public.client_policy_consents(client_id,accepted_at desc);
alter table public.client_policy_consents enable row level security;
revoke all on public.client_policy_consents from public,anon,authenticated;

create or replace function public.create_client_request_with_consent(
  p_therapist_id uuid,p_market text,p_currency text,p_client_message text,
  p_policy_version text,p_adult_confirmation boolean,p_country_code text,p_timezone text
)
returns table(request_id uuid,payment_id uuid,amount bigint,currency text)
language plpgsql security definer set search_path=''
as $function$
declare
  v_client uuid:=auth.uid(); v_country text:=upper(trim(coalesce(p_country_code,'')));
  v_timezone text:=trim(coalesce(p_timezone,'')); v_consent uuid;
  v_request uuid; v_payment uuid; v_amount bigint; v_currency text;
begin
  if v_client is null or not exists(select 1 from public.profiles p where p.id=v_client and p.role='client') then
    raise exception 'client_only' using errcode='42501';
  end if;
  if p_policy_version is distinct from '2026-11-16-v1-draft' then raise exception 'current_policy_version_required' using errcode='22023'; end if;
  if p_adult_confirmation is distinct from true then raise exception 'adult_confirmation_required' using errcode='22023'; end if;
  if v_country !~ '^[A-Z]{2}$' then raise exception 'valid_session_country_required' using errcode='22023'; end if;
  if v_timezone='' or length(v_timezone)>80 or not exists(select 1 from pg_timezone_names z where z.name=v_timezone) then
    raise exception 'valid_timezone_required' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.therapists t
    where t.id=p_therapist_id and t.is_listed and t.verified_at is not null
      and t.accepting_new_clients is true and v_country=any(t.practice_jurisdictions)
  ) then raise exception 'therapist_not_authorized_for_client_location' using errcode='42501'; end if;

  insert into public.client_policy_consents(client_id,policy_version,adult_confirmation,country_code,timezone,market,currency)
  values(v_client,p_policy_version,true,v_country,v_timezone,p_market,p_currency)
  returning id into v_consent;

  select r.request_id,r.payment_id,r.amount,r.currency into v_request,v_payment,v_amount,v_currency
  from public.create_client_request(p_therapist_id,p_market,p_currency,p_client_message) r;
  update public.client_policy_consents set request_id=v_request where id=v_consent;
  return query select v_request,v_payment,v_amount,v_currency;
end;
$function$;

revoke all on function public.create_client_request_with_consent(uuid,text,text,text,text,boolean,text,text) from public,anon;
grant execute on function public.create_client_request_with_consent(uuid,text,text,text,text,boolean,text,text) to authenticated;
