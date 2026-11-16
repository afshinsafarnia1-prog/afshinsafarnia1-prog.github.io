
alter table public.therapists
  add column if not exists years_experience integer
    check (years_experience between 0 and 60),
  add column if not exists practice_jurisdictions text[] not null default '{}',
  add column if not exists accepting_new_clients boolean not null default false;

alter table public.availability_slots
  add column if not exists timezone text not null default 'Asia/Tehran';

create or replace function public.get_public_therapist_directory_metadata()
returns table(therapist_id uuid, years_experience integer, practice_jurisdictions text[], accepting_new_clients boolean)
language sql stable security definer set search_path = ''
as $function$
  select t.id, t.years_experience, t.practice_jurisdictions, t.accepting_new_clients
  from public.therapists t
  where t.is_listed = true and t.verified_at is not null
  order by t.display_name;
$function$;

create or replace function public.get_public_therapist_public_metadata(p_therapist_id uuid)
returns table(years_experience integer, practice_jurisdictions text[], accepting_new_clients boolean)
language sql stable security definer set search_path = ''
as $function$
  select t.years_experience, t.practice_jurisdictions, t.accepting_new_clients
  from public.therapists t
  where t.id = p_therapist_id and t.is_listed = true and t.verified_at is not null;
$function$;

revoke all on function public.get_public_therapist_directory_metadata() from public;
revoke all on function public.get_public_therapist_public_metadata(uuid) from public;
grant execute on function public.get_public_therapist_directory_metadata() to anon, authenticated;
grant execute on function public.get_public_therapist_public_metadata(uuid) to anon, authenticated;
