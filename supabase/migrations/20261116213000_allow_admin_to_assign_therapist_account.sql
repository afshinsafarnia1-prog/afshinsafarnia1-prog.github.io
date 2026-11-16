-- Permit an AAL2 administrator to promote a non-admin account to therapist
-- and bind it to an already verified therapist profile.
create or replace function public.admin_assign_therapist_user(p_therapist_id uuid,p_user_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_role public.account_role;
begin
  perform public.require_admin_aal2();
  select p.role into v_role from public.profiles p where p.id=p_user_id for update;
  if not found then raise exception 'user_profile_required' using errcode='P0002'; end if;
  if v_role='admin' then raise exception 'admin_account_cannot_be_therapist' using errcode='22023'; end if;
  if not exists(select 1 from public.therapists t where t.id=p_therapist_id and t.verified_at is not null) then
    raise exception 'verified_therapist_required' using errcode='23514';
  end if;
  update public.profiles set role='therapist' where id=p_user_id;
  update public.therapists set owner_user_id=p_user_id,updated_at=now() where id=p_therapist_id;
  if not found then raise exception 'therapist_not_found' using errcode='P0002'; end if;
  return true;
end;
$function$;
