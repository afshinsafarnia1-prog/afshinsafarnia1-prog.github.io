-- YAD Center central tariffs, 70/30 revenue split, and manager-controlled public contact details.
-- Apply after the existing workshop and admin AAL2 migrations.

create table if not exists public.yad_tariff_history (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market in ('iran','international')),
  currency text not null check (
    (market='iran' and currency='IRR') or
    (market='international' and currency in ('EUR','USD'))
  ),
  amount bigint not null check (amount > 0),
  session_duration_minutes integer not null default 45 check (session_duration_minutes=45),
  therapist_percent integer not null check (therapist_percent between 1 and 99),
  platform_percent integer not null check (platform_percent between 1 and 99),
  effective_from timestamptz not null default now(),
  is_current boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (therapist_percent + platform_percent = 100)
);
create unique index if not exists yad_tariff_one_current_per_currency
  on public.yad_tariff_history(market,currency) where is_current;
alter table public.yad_tariff_history enable row level security;
revoke all on table public.yad_tariff_history from public,anon,authenticated;

alter table public.client_requests
  add column if not exists tariff_id uuid references public.yad_tariff_history(id),
  add column if not exists therapist_percent integer not null default 60,
  add column if not exists platform_percent integer not null default 40,
  add column if not exists session_duration_minutes integer not null default 45;
alter table public.client_requests
  drop constraint if exists client_requests_revenue_split_check;
alter table public.client_requests
  add constraint client_requests_revenue_split_check
  check (
    therapist_share_amount + platform_share_amount = amount
    and therapist_percent between 1 and 99
    and platform_percent between 1 and 99
    and therapist_percent + platform_percent = 100
    and session_duration_minutes between 20 and 180
  );

create table if not exists public.yad_public_contacts (
  id boolean primary key default true check (id),
  whatsapp_number text,
  instagram_url text,
  telegram_url text,
  youtube_url text,
  linkedin_url text,
  facebook_url text,
  contact_email text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
alter table public.yad_public_contacts enable row level security;
revoke all on table public.yad_public_contacts from public,anon,authenticated;
insert into public.yad_public_contacts(id) values(true) on conflict(id) do nothing;

create or replace function public.get_public_site_settings()
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  select jsonb_build_object(
    'tariffs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'market',t.market,'currency',t.currency,'amount',t.amount,
        'session_duration_minutes',t.session_duration_minutes,
        'therapist_percent',t.therapist_percent,'platform_percent',t.platform_percent,
        'effective_from',t.effective_from
      ) order by t.market,t.currency)
      from public.yad_tariff_history t
      where t.is_current and t.effective_from <= now()
    ), '[]'::jsonb),
    'contacts', coalesce((
      select to_jsonb(c) - 'id' - 'updated_by'
      from public.yad_public_contacts c where c.id=true
    ), '{}'::jsonb)
  );
$function$;

create or replace function public.admin_update_yad_business_settings(
  p_iran_irr bigint,
  p_international_eur bigint,
  p_international_usd bigint,
  p_therapist_percent integer,
  p_effective_from timestamptz,
  p_contacts jsonb
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_admin uuid := auth.uid();
  v_platform_percent integer := 100 - p_therapist_percent;
  v_effective timestamptz := coalesce(p_effective_from, now());
  v_contact jsonb := coalesce(p_contacts,'{}'::jsonb);
begin
  perform public.require_admin_aal2();
  if p_iran_irr is null or p_iran_irr <= 0
     or p_international_eur is null or p_international_eur <= 0
     or p_international_usd is null or p_international_usd <= 0 then
    raise exception 'all_three_tariffs_must_be_positive' using errcode='22023';
  end if;
  if p_therapist_percent not between 1 and 99 then
    raise exception 'invalid_therapist_percent' using errcode='22023';
  end if;
  if v_effective > now() then
    raise exception 'future_tariff_activation_not_supported_yet' using errcode='22023';
  end if;
  if length(coalesce(v_contact->>'whatsapp_number','')) > 40
     or length(coalesce(v_contact->>'contact_email','')) > 254 then
    raise exception 'contact_field_too_long' using errcode='22023';
  end if;
  if nullif(v_contact->>'contact_email','') is not null
     and (v_contact->>'contact_email') !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'invalid_contact_email' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_each_text(v_contact) e
    where e.key in ('instagram_url','telegram_url','youtube_url','linkedin_url','facebook_url')
      and e.value <> ''
      and e.value !~* '^https://'
  ) then
    raise exception 'social_links_must_use_https' using errcode='22023';
  end if;

  update public.yad_tariff_history set is_current=false
  where is_current and effective_from <= v_effective;

  insert into public.yad_tariff_history
    (market,currency,amount,session_duration_minutes,therapist_percent,platform_percent,effective_from,is_current,created_by)
  values
    ('iran','IRR',p_iran_irr,45,p_therapist_percent,v_platform_percent,v_effective,true,v_admin),
    ('international','EUR',p_international_eur,45,p_therapist_percent,v_platform_percent,v_effective,true,v_admin),
    ('international','USD',p_international_usd,45,p_therapist_percent,v_platform_percent,v_effective,true,v_admin);

  insert into public.yad_public_contacts(
    id,whatsapp_number,instagram_url,telegram_url,youtube_url,linkedin_url,facebook_url,contact_email,updated_at,updated_by
  ) values (
    true,
    nullif(trim(v_contact->>'whatsapp_number'),''),
    nullif(trim(v_contact->>'instagram_url'),''),
    nullif(trim(v_contact->>'telegram_url'),''),
    nullif(trim(v_contact->>'youtube_url'),''),
    nullif(trim(v_contact->>'linkedin_url'),''),
    nullif(trim(v_contact->>'facebook_url'),''),
    nullif(trim(v_contact->>'contact_email'),''),
    now(),v_admin
  )
  on conflict(id) do update set
    whatsapp_number=excluded.whatsapp_number,
    instagram_url=excluded.instagram_url,
    telegram_url=excluded.telegram_url,
    youtube_url=excluded.youtube_url,
    linkedin_url=excluded.linkedin_url,
    facebook_url=excluded.facebook_url,
    contact_email=excluded.contact_email,
    updated_at=now(),updated_by=v_admin;
  return true;
end;
$function$;

create or replace function public.create_client_request(
  p_therapist_id uuid,p_market text,p_currency text,p_client_message text default null
)
returns table(request_id uuid,payment_id uuid,amount bigint,currency text)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_client uuid := auth.uid();
  v_tariff public.yad_tariff_history%rowtype;
  v_request uuid;
  v_payment uuid;
  v_therapist_share bigint;
begin
  if v_client is null or not exists(
    select 1 from public.profiles p where p.id=v_client and p.role='client'
  ) then
    raise exception 'client_only' using errcode='42501';
  end if;
  if p_market not in ('iran','international')
     or (p_market='iran' and p_currency<>'IRR')
     or (p_market='international' and p_currency not in ('EUR','USD')) then
    raise exception 'invalid_market_or_currency' using errcode='22023';
  end if;
  if p_client_message is not null and length(p_client_message)>500 then
    raise exception 'message_too_long' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.therapists t
    where t.id=p_therapist_id and t.is_listed and t.verified_at is not null
  ) then
    raise exception 'therapist_not_available' using errcode='P0001';
  end if;
  select * into v_tariff
  from public.yad_tariff_history t
  where t.market=p_market and t.currency=p_currency
    and t.is_current and t.effective_from<=now()
  order by t.effective_from desc limit 1;
  if not found then
    raise exception 'central_tariff_not_configured' using errcode='P0001';
  end if;
  v_therapist_share := floor(v_tariff.amount * v_tariff.therapist_percent / 100.0)::bigint;
  insert into public.client_requests(
    client_id,therapist_id,market,currency,amount,therapist_share_amount,platform_share_amount,
    client_message,tariff_id,therapist_percent,platform_percent,session_duration_minutes
  ) values (
    v_client,p_therapist_id,p_market,p_currency,v_tariff.amount,v_therapist_share,
    v_tariff.amount-v_therapist_share,nullif(trim(p_client_message),''),
    v_tariff.id,v_tariff.therapist_percent,v_tariff.platform_percent,v_tariff.session_duration_minutes
  ) returning id into v_request;
  insert into public.payments(appointment_id,request_id,client_id,amount,currency,status,provider,provider_market)
  values(null,v_request,v_client,v_tariff.amount,p_currency,'pending','manual_transfer',p_market)
  returning id into v_payment;
  return query select v_request,v_payment,v_tariff.amount,p_currency;
end;
$function$;

revoke all on function public.get_public_site_settings() from public;
grant execute on function public.get_public_site_settings() to anon,authenticated;
revoke all on function public.admin_update_yad_business_settings(bigint,bigint,bigint,integer,timestamptz,jsonb) from public,anon;
grant execute on function public.admin_update_yad_business_settings(bigint,bigint,bigint,integer,timestamptz,jsonb) to authenticated;
revoke all on function public.create_client_request(uuid,text,text,text) from public,anon;
grant execute on function public.create_client_request(uuid,text,text,text) to authenticated;


create or replace function public.admin_list_requests(p_limit integer default 50,p_offset integer default 0)
returns table(
  request_id uuid,client_id uuid,client_name text,client_phone text,therapist_id uuid,therapist_name text,session_duration_minutes integer,
  amount bigint,currency text,therapist_share_amount bigint,platform_share_amount bigint,
  request_status text,payment_id uuid,payment_status public.payment_status,provider_reference text,created_at timestamptz
)
language plpgsql security definer set search_path=''
as $$
declare
  v_limit integer:=least(greatest(coalesce(p_limit,50),1),100);
  v_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  perform public.require_admin_aal2();
  return query
  select r.id,r.client_id,cp.display_name,cp.phone,r.therapist_id,t.display_name,r.session_duration_minutes,r.amount,r.currency,
    r.therapist_share_amount,r.platform_share_amount,r.status,p.id,p.status,p.provider_reference,r.created_at
  from public.client_requests r
  join public.profiles cp on cp.id=r.client_id
  join public.therapists t on t.id=r.therapist_id
  left join public.payments p on p.request_id=r.id
  order by r.created_at desc,r.id limit v_limit offset v_offset;
end;
$$;
revoke all on function public.admin_list_requests(integer,integer) from public,anon;
grant execute on function public.admin_list_requests(integer,integer) to authenticated;
