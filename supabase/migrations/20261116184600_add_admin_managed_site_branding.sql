-- Admin-managed public brand identity and manager profile.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('site-assets','site-assets',true,5242880,array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update set
  public=true,
  file_size_limit=5242880,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists site_assets_public_read on storage.objects;
create policy site_assets_public_read on storage.objects
for select to anon, authenticated
using (bucket_id='site-assets');

drop policy if exists site_assets_admin_insert on storage.objects;
create policy site_assets_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='site-assets'
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
  and (select auth.jwt()->>'aal')='aal2'
);

drop policy if exists site_assets_admin_update on storage.objects;
create policy site_assets_admin_update on storage.objects
for update to authenticated
using (
  bucket_id='site-assets'
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
  and (select auth.jwt()->>'aal')='aal2'
)
with check (
  bucket_id='site-assets'
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
  and (select auth.jwt()->>'aal')='aal2'
);

drop policy if exists site_assets_admin_delete on storage.objects;
create policy site_assets_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id='site-assets'
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
  and (select auth.jwt()->>'aal')='aal2'
);

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
    'brand_name',coalesce(v_name,'یادسنتر'),
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

create or replace function public.get_public_site_settings()
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  select jsonb_build_object(
    'tariffs',coalesce((
      select jsonb_agg(jsonb_build_object(
        'market',t.market,'currency',t.currency,'amount',t.amount,
        'session_duration_minutes',t.session_duration_minutes,
        'therapist_percent',t.therapist_percent,'platform_percent',t.platform_percent,
        'effective_from',t.effective_from
      ) order by t.market,t.currency)
      from public.yad_tariff_history t
      where t.is_current and t.effective_from<=now()
    ),'[]'::jsonb),
    'contacts',coalesce((
      select to_jsonb(c)-'id'-'updated_by'
      from public.yad_public_contacts c where c.id=true
    ),'{}'::jsonb),
    'branding',coalesce((
      select s.value from public.site_settings s where s.key='site_branding'
    ),'{}'::jsonb),
    'client_intake_enabled',coalesce((
      select (s.value#>>'{}')::boolean from public.site_settings s where s.key='client_intake_enabled'
    ),false),
    'client_policy_version',coalesce((
      select s.value#>>'{}' from public.site_settings s where s.key='client_policy_version'
    ),'2026-11-16-v1-draft')
  );
$function$;

revoke all on function public.get_public_site_settings() from public;
grant execute on function public.get_public_site_settings() to anon,authenticated;
