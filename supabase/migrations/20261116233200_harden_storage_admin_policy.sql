-- Close permissive storage policy: only AAL2 administrators may use privileged storage paths.
drop policy if exists admin_storage_requires_aal2 on storage.objects;
create policy admin_storage_requires_aal2 on storage.objects
for all to authenticated
using (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
  and (select auth.jwt()->>'aal')='aal2'
)
with check (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
  and (select auth.jwt()->>'aal')='aal2'
);