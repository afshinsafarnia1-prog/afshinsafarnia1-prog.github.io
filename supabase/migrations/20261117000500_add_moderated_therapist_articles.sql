create table if not exists public.therapist_articles (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  title text not null,
  slug text unique,
  excerpt text not null,
  body text not null,
  language text not null default 'fa' check (language in ('fa','ku','en','tr','ar','es','de','fr')),
  status text not null default 'pending_review' check (status in ('pending_review','revision_requested','rejected','published')),
  editor_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint therapist_articles_title_length check (char_length(title) between 5 and 180),
  constraint therapist_articles_excerpt_length check (char_length(excerpt) between 30 and 500),
  constraint therapist_articles_body_length check (char_length(body) between 500 and 20000)
);
create index if not exists therapist_articles_status_submitted_idx
  on public.therapist_articles(status, submitted_at desc);
create index if not exists therapist_articles_therapist_idx
  on public.therapist_articles(therapist_id, submitted_at desc);
alter table public.therapist_articles enable row level security;
revoke all on public.therapist_articles from anon, authenticated;

create or replace function public.therapist_submit_article(
  p_title text,p_excerpt text,p_body text,p_language text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_therapist uuid; v_id uuid;
begin
 if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.role='therapist') then
   raise exception 'therapist_only' using errcode='42501';
 end if;
 select t.id into v_therapist from public.therapists t
 where t.owner_user_id=v_user and t.verified_at is not null and t.is_listed;
 if v_therapist is null then raise exception 'verified_therapist_profile_required' using errcode='42501'; end if;
 if char_length(trim(coalesce(p_title,''))) not between 5 and 180
   or char_length(trim(coalesce(p_excerpt,''))) not between 30 and 500
   or char_length(trim(coalesce(p_body,''))) not between 500 and 20000
   or p_language not in ('fa','ku','en','tr','ar','es','de','fr') then
   raise exception 'invalid_article_content' using errcode='22023';
 end if;
 insert into public.therapist_articles(therapist_id,title,excerpt,body,language,status,submitted_at,updated_at)
 values(v_therapist,trim(p_title),trim(p_excerpt),trim(p_body),p_language,'pending_review',now(),now())
 returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.therapist_submit_article(text,text,text,text) from public,anon;
grant execute on function public.therapist_submit_article(text,text,text,text) to authenticated;

create or replace function public.therapist_list_my_articles()
returns table(id uuid,title text,status text,editor_note text,submitted_at timestamptz,published_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.role='therapist') then
   raise exception 'therapist_only' using errcode='42501';
 end if;
 return query select a.id,a.title,a.status,a.editor_note,a.submitted_at,a.published_at
 from public.therapist_articles a join public.therapists t on t.id=a.therapist_id
 where t.owner_user_id=v_user order by a.submitted_at desc;
end; $$;
revoke all on function public.therapist_list_my_articles() from public,anon;
grant execute on function public.therapist_list_my_articles() to authenticated;

create or replace function public.admin_list_therapist_articles()
returns table(id uuid,title text,excerpt text,body text,language text,status text,editor_note text,
 therapist_name text,submitted_at timestamptz,slug text)
language plpgsql stable security definer set search_path=''
as $$
begin
 perform public.require_admin_aal2();
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then
   raise exception 'admin_only' using errcode='42501';
 end if;
 return query select a.id,a.title,a.excerpt,a.body,a.language,a.status,a.editor_note,
 t.display_name,a.submitted_at,a.slug
 from public.therapist_articles a join public.therapists t on t.id=a.therapist_id
 order by case when a.status='pending_review' then 0 else 1 end,a.submitted_at desc;
end; $$;
revoke all on function public.admin_list_therapist_articles() from public,anon;
grant execute on function public.admin_list_therapist_articles() to authenticated;

create or replace function public.admin_review_therapist_article(
 p_article_id uuid,p_status text,p_editor_note text default null,p_slug text default null
) returns boolean language plpgsql security definer set search_path=''
as $$
declare v_slug text:=lower(trim(coalesce(p_slug,'')));
begin
 perform public.require_admin_aal2();
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then
   raise exception 'admin_only' using errcode='42501';
 end if;
 if p_status not in ('revision_requested','rejected','published') then
   raise exception 'invalid_article_review_status' using errcode='22023';
 end if;
 if char_length(coalesce(p_editor_note,''))>2000 then raise exception 'editor_note_too_long' using errcode='22023'; end if;
 if p_status='published' and (v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug)>120) then
   raise exception 'valid_public_slug_required' using errcode='22023';
 end if;
 update public.therapist_articles set status=p_status,editor_note=nullif(trim(coalesce(p_editor_note,'')),''),
   slug=case when p_status='published' then v_slug else slug end,
   reviewed_at=now(),published_at=case when p_status='published' then now() else null end,updated_at=now()
 where id=p_article_id;
 if not found then raise exception 'article_not_found' using errcode='P0002'; end if;
 return true;
end; $$;
revoke all on function public.admin_review_therapist_article(uuid,text,text,text) from public,anon;
grant execute on function public.admin_review_therapist_article(uuid,text,text,text) to authenticated;

create or replace function public.public_list_therapist_articles()
returns table(title text,slug text,excerpt text,language text,therapist_name text,published_at timestamptz)
language sql stable security definer set search_path=''
as $$
 select a.title,a.slug,a.excerpt,a.language,t.display_name,a.published_at
 from public.therapist_articles a join public.therapists t on t.id=a.therapist_id
 where a.status='published' and a.published_at is not null and t.is_listed and t.verified_at is not null
 order by a.published_at desc limit 100;
$$;
revoke all on function public.public_list_therapist_articles() from public;
grant execute on function public.public_list_therapist_articles() to anon,authenticated;

create or replace function public.public_get_therapist_article(p_slug text)
returns table(title text,body text,language text,therapist_name text,published_at timestamptz)
language sql stable security definer set search_path=''
as $$
 select a.title,a.body,a.language,t.display_name,a.published_at
 from public.therapist_articles a join public.therapists t on t.id=a.therapist_id
 where a.slug=p_slug and a.status='published' and a.published_at is not null
   and t.is_listed and t.verified_at is not null limit 1;
$$;
revoke all on function public.public_get_therapist_article(text) from public;
grant execute on function public.public_get_therapist_article(text) to anon,authenticated;
