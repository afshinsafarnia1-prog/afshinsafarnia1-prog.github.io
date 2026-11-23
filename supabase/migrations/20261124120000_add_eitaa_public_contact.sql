alter table public.yad_public_contacts add column if not exists eitaa_url text;

create or replace function public.admin_update_yad_public_contacts(p_contacts jsonb)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_admin uuid:=auth.uid(); v_contact jsonb:=coalesce(p_contacts,'{}'::jsonb);
begin
 perform public.require_admin_aal2();
 if length(coalesce(v_contact->>'whatsapp_number',''))>40
    or length(coalesce(v_contact->>'phone_number',''))>40
    or length(coalesce(v_contact->>'contact_email',''))>254 then
  raise exception 'contact_field_too_long' using errcode='22023';
 end if;
 if nullif(v_contact->>'contact_email','') is not null
    and (v_contact->>'contact_email') !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$' then
  raise exception 'invalid_contact_email' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_each_text(v_contact) e
   where e.key in ('instagram_url','telegram_url','eitaa_url','youtube_url','linkedin_url','facebook_url')
   and e.value<>'' and e.value !~* '^https://') then
  raise exception 'social_links_must_use_https' using errcode='22023';
 end if;
 insert into public.yad_public_contacts(id,phone_number,whatsapp_number,instagram_url,telegram_url,eitaa_url,youtube_url,linkedin_url,facebook_url,contact_email,updated_at,updated_by)
 values(true,nullif(trim(v_contact->>'phone_number'),''),nullif(trim(v_contact->>'whatsapp_number'),''),
 nullif(trim(v_contact->>'instagram_url'),''),nullif(trim(v_contact->>'telegram_url'),''),
 nullif(trim(v_contact->>'eitaa_url'),''),nullif(trim(v_contact->>'youtube_url'),''),
 nullif(trim(v_contact->>'linkedin_url'),''),nullif(trim(v_contact->>'facebook_url'),''),
 nullif(trim(v_contact->>'contact_email'),''),now(),v_admin)
 on conflict(id) do update set phone_number=excluded.phone_number,whatsapp_number=excluded.whatsapp_number,
 instagram_url=excluded.instagram_url,telegram_url=excluded.telegram_url,eitaa_url=excluded.eitaa_url,
 youtube_url=excluded.youtube_url,linkedin_url=excluded.linkedin_url,facebook_url=excluded.facebook_url,
 contact_email=excluded.contact_email,updated_at=now(),updated_by=v_admin;
 return true;
end; $$;
revoke all on function public.admin_update_yad_public_contacts(jsonb) from public,anon;
grant execute on function public.admin_update_yad_public_contacts(jsonb) to authenticated;

update public.yad_public_contacts
set telegram_url='https://t.me/Yadshin1',
    eitaa_url='https://eitaa.com/Yadshin1',
    updated_at=now()
where id=true;
