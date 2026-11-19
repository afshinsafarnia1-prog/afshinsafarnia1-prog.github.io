-- Allow a therapist to retrieve and resubmit only articles returned for revision.
create or replace function public.therapist_get_article_for_revision(p_article_id uuid)
returns table(id uuid,title text,excerpt text,body text,language text,editor_note text)
language plpgsql stable security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.role='therapist') then
   raise exception 'therapist_only' using errcode='42501';
 end if;
 return query
 select a.id,a.title,a.excerpt,a.body,a.language,a.editor_note
 from public.therapist_articles a
 join public.therapists t on t.id=a.therapist_id
 where a.id=p_article_id and t.owner_user_id=v_user and a.status='revision_requested';
 if not found then raise exception 'article_not_available_for_revision' using errcode='P0002'; end if;
end; $$;
revoke all on function public.therapist_get_article_for_revision(uuid) from public,anon;
grant execute on function public.therapist_get_article_for_revision(uuid) to authenticated;

create or replace function public.therapist_resubmit_article(
 p_article_id uuid,p_title text,p_excerpt text,p_body text,p_language text
) returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.role='therapist') then
   raise exception 'therapist_only' using errcode='42501';
 end if;
 if char_length(trim(coalesce(p_title,''))) not between 5 and 180
   or char_length(trim(coalesce(p_excerpt,''))) not between 30 and 500
   or char_length(trim(coalesce(p_body,''))) not between 500 and 20000
   or p_language not in ('fa','ku','en','tr','ar','es','de','fr') then
   raise exception 'invalid_article_content' using errcode='22023';
 end if;
 update public.therapist_articles a
 set title=trim(p_title),excerpt=trim(p_excerpt),body=trim(p_body),language=p_language,
     status='pending_review',editor_note=null,submitted_at=now(),reviewed_at=null,
     published_at=null,updated_at=now()
 from public.therapists t
 where a.id=p_article_id and t.id=a.therapist_id and t.owner_user_id=v_user
   and a.status='revision_requested';
 if not found then raise exception 'article_not_available_for_revision' using errcode='P0002'; end if;
 return true;
end; $$;
revoke all on function public.therapist_resubmit_article(uuid,text,text,text,text) from public,anon;
grant execute on function public.therapist_resubmit_article(uuid,text,text,text,text) to authenticated;
