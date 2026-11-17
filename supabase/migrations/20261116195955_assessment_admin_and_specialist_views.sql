create or replace function public.admin_get_assessment_fees() returns table(assessment_type text,currency text,amount bigint,is_active boolean) language plpgsql stable security definer set search_path='' as $$
begin perform public.require_admin_aal2(); return query select f.assessment_type,f.currency,f.amount,f.is_active from public.assessment_fee_schedule f order by f.assessment_type,f.currency; end; $$;
revoke all on function public.admin_get_assessment_fees() from public,anon; grant execute on function public.admin_get_assessment_fees() to authenticated;
create or replace function public.admin_list_assessment_specialist_flags() returns table(therapist_id uuid,is_assessment_specialist boolean) language plpgsql stable security definer set search_path='' as $$
begin perform public.require_admin_aal2(); return query select t.id,t.is_assessment_specialist from public.therapists t; end; $$;
revoke all on function public.admin_list_assessment_specialist_flags() from public,anon; grant execute on function public.admin_list_assessment_specialist_flags() to authenticated;
create or replace function public.therapist_list_assessment_requests() returns table(request_id uuid,client_name text,assessment_type text,currency text,amount bigint,status text,scheduled_at timestamptz,recommendations text,recommended_therapist_ids uuid[]) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='therapist') then raise exception 'therapist_only' using errcode='42501'; end if;
 return query select r.id,coalesce(p.display_name,'مراجع'),r.assessment_type,r.currency,r.amount,r.status,r.scheduled_at,r.recommendations,r.recommended_therapist_ids
 from public.assessment_requests r join public.therapists t on t.id=r.specialist_id left join public.profiles p on p.id=r.client_id
 where t.owner_user_id=auth.uid() and r.status in ('scheduled','completed') order by r.scheduled_at desc nulls last;
end; $$;
revoke all on function public.therapist_list_assessment_requests() from public,anon; grant execute on function public.therapist_list_assessment_requests() to authenticated;