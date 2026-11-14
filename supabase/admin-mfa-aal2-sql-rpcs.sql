-- Convert SQL-language admin list RPCs to PL/pgSQL so the AAL2 guard
-- executes unconditionally, even when their result tables contain no rows.
do $migration$
declare
  r record;
  v_definition text;
  v_updated text;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
      and left(p.proname, 6) = 'admin_'
      and p.prosecdef
      and l.lanname = 'sql'
  loop
    v_definition := pg_get_functiondef(r.oid);
    v_updated := regexp_replace(v_definition, 'LANGUAGE[[:space:]]+sql', 'LANGUAGE plpgsql', 'i');
    v_updated := replace(
      v_updated,
      'AS $function$',
      'AS $function$' || chr(10) ||
      'BEGIN' || chr(10) ||
      '  PERFORM public.require_admin_aal2();' || chr(10) ||
      '  RETURN QUERY' || chr(10)
    );
    v_updated := regexp_replace(
      v_updated,
      E';[[:space:]]*\\$function\\$$',
      ';' || chr(10) || 'END;' || chr(10) || '$function$',
      'i'
    );

    if v_updated = v_definition
       or position('PERFORM public.require_admin_aal2()' in v_updated) = 0
       or position('RETURN QUERY' in v_updated) = 0
       or position('END;' in v_updated) = 0 then
      raise exception 'Could not safely convert SQL admin RPC %', r.proname;
    end if;

    execute v_updated;
  end loop;
end;
$migration$;
