create or replace function public.therapist_set_my_fee(p_currency text,p_amount bigint)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_therapist_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='therapist') then raise exception 'therapist_only' using errcode='42501'; end if;
 if p_currency not in ('IRR','EUR','USD','CAD') or p_amount is null or p_amount<=0 then raise exception 'invalid_fee' using errcode='22023'; end if;
 select t.id into v_therapist_id from public.therapists t where t.owner_user_id=auth.uid() order by t.updated_at desc limit 1;
 if v_therapist_id is null then raise exception 'therapist_profile_not_linked' using errcode='P0002'; end if;
 insert into public.therapist_fees(therapist_id,currency,amount,updated_by,updated_at) values(v_therapist_id,p_currency,p_amount,auth.uid(),now())
 on conflict(therapist_id,currency) do update set amount=excluded.amount,updated_by=auth.uid(),updated_at=now();
 return true;
end; $$;
revoke all on function public.therapist_set_my_fee(text,bigint) from public,anon;
grant execute on function public.therapist_set_my_fee(text,bigint) to authenticated;