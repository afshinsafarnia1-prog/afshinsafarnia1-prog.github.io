create or replace function public.admin_update_site_branding(p_branding jsonb)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v jsonb:=coalesce(p_branding,'{}'::jsonb);
  v_name text:=nullif(trim(v->>'brand_name'),'');
  v_tagline text:=nullif(trim(v->>'tagline'),'');
  v_manager text:=nullif(trim(v->>'manager_name'),'');
  v_title text:=nullif(trim(v->>'manager_title'),'');
  v_bio text:=nullif(trim(v->>'manager_bio'),'');
  v_logo text:=nullif(trim(v->>'logo_path'),'');
  v_photo text:=nullif(trim(v->>'manager_photo_path'),'');
begin
  perform public.require_admin_aal2();
  if length(coalesce(v_name,''))>100 or length(coalesce(v_tagline,''))>220
     or length(coalesce(v_manager,''))>120 or length(coalesce(v_title,''))>160
     or length(coalesce(v_bio,''))>1800 then
    raise exception 'branding_field_too_long' using errcode='22023';
  end if;
  if (v_logo is not null and v_logo !~ '^site-assets/[A-Za-z0-9_-]+/[A-Za-z0-9._-]+$')
     or (v_photo is not null and v_photo !~ '^site-assets/[A-Za-z0-9_-]+/[A-Za-z0-9._-]+$') then
    raise exception 'invalid_site_asset_path' using errcode='22023';
  end if;
  insert into public.site_settings(key,value,updated_by,updated_at)
  values ('site_branding',jsonb_build_object(
    'brand_name',coalesce(v_name,'ردیاد'),
    'tagline',coalesce(v_tagline,'فضایی برای فهم بهتر خود و انتخاب آگاهانه مسیر درمان'),
    'manager_name',v_manager,'manager_title',v_title,'manager_bio',v_bio,
    'logo_path',v_logo,'manager_photo_path',v_photo
  ),auth.uid(),now())
  on conflict(key) do update set value=excluded.value,updated_by=auth.uid(),updated_at=now();
  return true;
end;
$function$;

revoke all on function public.admin_update_site_branding(jsonb) from public,anon;
grant execute on function public.admin_update_site_branding(jsonb) to authenticated;
