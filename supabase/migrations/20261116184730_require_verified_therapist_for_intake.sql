create or replace function public.admin_set_client_intake(p_enabled boolean,p_policy_version text)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare
 v_admin uuid:=auth.uid();
 v_version text:=trim(coalesce(p_policy_version,''));
 v_active_tariffs integer;
 v_active_therapists integer;
begin
 perform public.require_admin_aal2();
 if p_enabled is null then raise exception 'intake_state_required' using errcode='22023'; end if;
 if p_enabled and (
   length(v_version)<5 or length(v_version)>80
   or v_version ilike '%draft%' or v_version ilike '%test%' or v_version ilike '%preview%'
 ) then raise exception 'approved_policy_version_required' using errcode='22023'; end if;
 if p_enabled then
   select count(*) into v_active_tariffs from public.yad_tariff_history
   where is_current and effective_from<=now();
   if v_active_tariffs<3 then raise exception 'all_three_tariffs_must_be_configured' using errcode='55000'; end if;
   select count(*) into v_active_therapists from public.therapists
   where verified_at is not null and is_listed and accepting_new_clients;
   if v_active_therapists<1 then raise exception 'at_least_one_verified_therapist_accepting_clients_required' using errcode='55000'; end if;
 end if;
 insert into public.site_settings(key,value,updated_by,updated_at)
 values ('client_intake_enabled',to_jsonb(p_enabled),v_admin,now()),
        ('client_policy_version',to_jsonb(v_version),v_admin,now())
 on conflict(key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=now();
 return true;
end;$function$;