-- Include the published slug in the therapist's own article status list.
drop function if exists public.therapist_list_my_articles();
create function public.therapist_list_my_articles()
returns table(id uuid,title text,status text,editor_note text,submitted_at timestamptz,published_at timestamptz,slug text)
language plpgsql stable security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.role='therapist') then
   raise exception 'therapist_only' using errcode='42501';
 end if;
 return query
 select a.id,a.title,a.status,a.editor_note,a.submitted_at,a.published_at,a.slug
 from public.therapist_articles a
 join public.therapists t on t.id=a.therapist_id
 where t.owner_user_id=v_user
 order by a.submitted_at desc;
end; $$;
revoke all on function public.therapist_list_my_articles() from public,anon;
grant execute on function public.therapist_list_my_articles() to authenticated;
