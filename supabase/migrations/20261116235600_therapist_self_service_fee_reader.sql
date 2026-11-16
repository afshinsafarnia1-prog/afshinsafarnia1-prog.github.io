create or replace function public.therapist_get_my_fees()
returns table(currency text,amount bigint,session_duration_minutes integer)
language plpgsql stable security definer set search_path=''
as $$
begin
 return query
 select f.currency,f.amount,f.session_duration_minutes
 from public.therapist_fees f
 join public.therapists t on t.id=f.therapist_id
 where t.owner_user_id=auth.uid()
   and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='therapist');
end; $$;
revoke all on function public.therapist_get_my_fees() from public,anon;
grant execute on function public.therapist_get_my_fees() to authenticated;