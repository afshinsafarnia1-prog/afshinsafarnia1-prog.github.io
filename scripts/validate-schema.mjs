import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "supabase", "schema.sql");
if (!fs.existsSync(file)) {
  console.error("Missing supabase/schema.sql");
  process.exit(1);
}

const sql = fs.readFileSync(file, "utf8");
const normalized = sql.toLowerCase();
const errors = [];
const requiredTables = [
  "profiles", "therapists", "therapist_prices", "availability_slots",
  "appointments", "payments", "payout_accounts", "site_settings"
];

for (const table of requiredTables) {
  const pattern = new RegExp(
    "alter\\s+table\\s+public\\." + table + "\\s+enable\\s+row\\s+level\\s+security",
    "i"
  );
  if (!pattern.test(sql)) errors.push("RLS is not explicitly enabled for public." + table);
}

if (!/create\s+extension\s+if\s+not\s+exists\s+btree_gist/i.test(sql)) {
  errors.push("Missing btree_gist extension required for overlap exclusion constraint");
}
if (!/constraint\s+appointments_no_overlapping_active_sessions\s+exclude\s+using\s+gist[\s\S]*?where\s*\(\s*status\s+in\s*\(\s*'requested'\s*,\s*'confirmed'\s*\)\s*\)/i.test(sql)) {
  errors.push("Missing database-level exclusion constraint for overlapping active appointments");
}

for (const table of ["appointments", "payments", "payout_accounts", "site_settings"]) {
  const unsafeGrant = new RegExp(
    "grant\\s+(?:all|insert|update|delete)[^;]*\\bon\\s+(?:table\\s+)?public\\." +
    table + "[^;]*\\bto\\s+(?:public|anon|authenticated)",
    "i"
  );
  if (unsafeGrant.test(sql)) errors.push("Potential browser write grant found for public." + table);
}

function getFunctionBody(name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sql.match(new RegExp(
    "create\\s+or\\s+replace\\s+function\\s+public\\." + escapedName +
    "[\\s\\S]*?\\$\\$;",
    "i"
  ));
  return match?.[0] ?? null;
}

for (const name of ["request_appointment", "submit_manual_payment_reference", "admin_review_manual_payment"]) {
  const body = getFunctionBody(name);
  if (!body) {
    errors.push("Missing controlled RPC: " + name);
    continue;
  }
  if (!/security\s+definer/i.test(body)) errors.push(name + " must be SECURITY DEFINER");
  if (!/set\s+search_path\s*=\s*''/i.test(body)) errors.push(name + " must pin an empty search_path");
}

const profileTrigger = /create\s+or\s+replace\s+function\s+public\.handle_new_user[\s\S]*?insert\s+into\s+public\.profiles[\s\S]*?values\s*\(\s*new\.id[\s\S]*?\);[\s\S]*?\$\$;/i;
if (!profileTrigger.test(sql)) errors.push("New auth users must receive a client profile through handle_new_user");
if (!/create\s+trigger\s+on_auth_user_created[\s\S]*?after\s+insert\s+on\s+auth\.users/i.test(sql)) {
  errors.push("Missing auth.users profile-creation trigger");
}

for (const name of ["request_appointment", "submit_manual_payment_reference"]) {
  const body = getFunctionBody(name);
  if (!body || !/p\.role\s*=\s*'client'/i.test(body)) {
    errors.push(name + " must enforce the client role");
  }
}
if (!/v_admin\s+uuid\s*:=\s*auth\.uid\(\)/i.test(getFunctionBody("admin_review_manual_payment") ?? "")) {
  errors.push("Admin payment review must derive the actor from auth.uid()");
}

const requiredPrivileges = [
  "revoke insert, update, delete on public.appointments from anon, authenticated",
  "revoke insert, update, delete on public.payments from anon, authenticated",
  "revoke insert, update, delete on public.payout_accounts from anon, authenticated",
  "revoke insert, update, delete on public.site_settings from anon, authenticated",
  "grant execute on function public.request_appointment(uuid,text,text,text) to authenticated",
  "grant execute on function public.submit_manual_payment_reference(uuid,text) to authenticated",
  "grant execute on function public.admin_review_manual_payment(uuid,boolean) to authenticated"
];
for (const marker of requiredPrivileges) {
  if (!normalized.includes(marker)) errors.push("Missing privilege boundary: " + marker);
}

if (/service[_-]?role[_-]?key\s*[:=]\s*['"][^'"]{12,}/i.test(sql)) {
  errors.push("Possible service-role credential found in schema");
}

const upgradeFile = path.join(process.cwd(), "supabase", "upgrade-client-choice-payment-first.sql");
if (!fs.existsSync(upgradeFile)) {
  errors.push("Missing supabase/upgrade-client-choice-payment-first.sql");
} else {
  const upgrade = fs.readFileSync(upgradeFile, "utf8");
  const upgradeNormalized = upgrade.toLowerCase();
  const requiredUpgradeFunctions = [
    "admin_save_therapist", "admin_set_therapist_prices", "create_client_request",
    "submit_manual_payment_reference", "admin_review_manual_payment",
    "admin_list_requests", "admin_schedule_request", "admin_list_therapists",
    "client_list_requests"
  ];
  for (const name of requiredUpgradeFunctions) {
    const pattern = new RegExp("create\\s+(?:or\\s+replace\\s+)?function\\s+public\\." + name + "\\b", "i");
    if (!pattern.test(upgrade)) errors.push("Missing workflow RPC in upgrade SQL: " + name);
  }
  if (!/create\s+table\s+if\s+not\s+exists\s+public\.client_requests/i.test(upgrade)) {
    errors.push("Missing client_requests table in workflow upgrade");
  }
  if (!/alter\s+table\s+public\.client_requests\s+enable\s+row\s+level\s+security/i.test(upgrade)) {
    errors.push("Client requests must have RLS enabled");
  }
  if (!/floor\(v_amount\s*\*\s*0\.60\)/i.test(upgrade) ||
      !/v_amount\s*-\s*v_therapist_share/i.test(upgrade)) {
    errors.push("The 60/40 therapist/platform revenue split is missing");
  }
  if (!/therapist-documents','therapist-documents',false/i.test(upgrade)) {
    errors.push("Therapist license documents must use a private Storage bucket");
  }
  if (!/therapist-photos','therapist-photos',true/i.test(upgrade)) {
    errors.push("Therapist profile photos must use the public photos bucket");
  }
  if (!/drop\s+constraint\s+if\s+exists\s+therapists_id_fkey/i.test(upgrade)) {
    errors.push("Therapist profiles must not require a therapist Auth account");
  }
  if (!/revoke\s+all\s+on\s+function\s+public\.request_appointment\(uuid,text,text,text\)\s+from\s+public,anon,authenticated/i.test(upgrade)) {
    errors.push("Legacy pre-payment booking RPC must be disabled");
  }
  if (!/request_not_ready_to_schedule/i.test(upgrade) || !/status='payment_verified'/i.test(upgrade)) {
    errors.push("Appointment scheduling must require a payment-verified request");
  }
  if (/service[_-]?role[_-]?key\s*[:=]\s*['"][^'"]{12,}/i.test(upgrade)) {
    errors.push("Possible service-role credential found in workflow upgrade");
  }
}


const completionFile = path.join(process.cwd(), "supabase", "platform-completion-2026-11.sql");
if (!fs.existsSync(completionFile)) {
  errors.push("Missing supabase/platform-completion-2026-11.sql");
} else {
  const completion = fs.readFileSync(completionFile, "utf8");
  const completionLower = completion.toLowerCase();
  if (!completion.includes("REVIEW DRAFT ONLY") || !completion.includes("has NOT been executed")) {
    errors.push("Platform completion migration must clearly remain marked as unapplied review draft");
  }
  const dollarTags = [...completion.matchAll(/\$function\$/g)].length;
  if (dollarTags % 2 !== 0) errors.push("Platform completion migration has an unmatched function delimiter");
  const functionNames = [...completion.matchAll(/create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)\s*\(/gi)].map(match => match[1].toLowerCase());
  const duplicates = functionNames.filter((name,index) => functionNames.indexOf(name)!==index);
  if (duplicates.length) errors.push("Duplicate function definitions in platform migration: " + [...new Set(duplicates)].join(", "));
  for (const table of ["appointment_private_access","client_support_tickets","client_appointment_feedback","client_policy_consents","client_notifications"]) {
    if (!new RegExp("alter\\s+table\\s+public\\."+table+"\\s+enable\\s+row\\s+level\\s+security","i").test(completion)) {
      errors.push("Platform migration must enable RLS for public." + table);
    }
    if (!new RegExp("revoke\\s+all\\s+on\\s+public\\."+table+"\\s+from\\s+public,\\s*anon,\\s*authenticated","i").test(completion)) {
      errors.push("Platform migration must deny direct browser access to public." + table);
    }
  }
  const adminRpcs = [
    "admin_set_therapist_public_metadata","admin_list_therapist_public_metadata",
    "admin_create_availability_slot","admin_list_availability_slots","admin_delete_availability_slot",
    "admin_list_request_details","admin_list_available_slots_for_request","admin_schedule_request_from_slot",
    "admin_set_appointment_meeting","admin_list_appointment_private_access",
    "admin_get_appointment_timezone","admin_list_request_client_timezones",
    "admin_list_support_tickets","admin_update_support_ticket","admin_resolve_support_cancellation",
    "admin_resolve_support_reschedule","admin_resolve_support_therapist_change",
    "admin_mark_appointment_completed","admin_list_appointment_feedback","admin_moderate_appointment_feedback"
  ];
  for (const name of adminRpcs) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = completion.match(new RegExp("create\\s+or\\s+replace\\s+function\\s+public\\."+escaped+"[\\s\\S]*?\\$function\\$;","i"));
    if (!match) { errors.push("Missing platform admin RPC: " + name); continue; }
    if (!/security\s+definer/i.test(match[0]) || !/set\s+search_path\s*=\s*''/i.test(match[0]) || !/require_admin_aal2\(\)/i.test(match[0])) {
      errors.push(name + " must be SECURITY DEFINER, pin search_path and require AAL2");
    }
  }
  for (const name of ["client_list_appointments","client_submit_support_ticket","client_list_support_tickets","client_list_notifications","client_mark_notification_read","client_submit_appointment_feedback","create_client_request_with_consent"]) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = completion.match(new RegExp("create\\s+or\\s+replace\\s+function\\s+public\\."+escaped+"[\\s\\S]*?\\$function\\$;","i"));
    if (!match || !/security\s+definer/i.test(match[0]) || !/set\s+search_path\s*=\s*''/i.test(match[0])) {
      errors.push(name + " must be a pinned SECURITY DEFINER RPC");
    }
  }
  if (!/revoke\s+all\s+on\s+function\s+public\.create_client_request\(uuid,text,text,text\)\s+from\s+public,\s*anon,\s*authenticated/i.test(completion)) {
    errors.push("Legacy request creation must be revoked so adult/jurisdiction consent cannot be bypassed");
  }
  if (!/therapist_not_authorized_for_client_location/i.test(completion) || !/adult_confirmation_required/i.test(completion)) {
    errors.push("Client request creation must enforce adult confirmation and therapist jurisdiction");
  }
  if (!/admin_schedule_request_from_slot/i.test(completion) || !/tstzrange/i.test(completion)) {
    errors.push("Scheduling must use administrator-managed slots and conflict checks");
  }
  if (!/appointment_private_access/i.test(completion) || !/client_list_appointments/i.test(completion)) {
    errors.push("Private appointment access RPCs are missing");
  }
}


const workshopMigrationPath = path.join(process.cwd(), "supabase", "migrations", "20261116152208_secure_and_complete_workshop_admin_workflow.sql");
if (!fs.existsSync(workshopMigrationPath)) {
  errors.push("Missing applied workshop security migration matching the Supabase migration version");
} else {
  const workshopSql = fs.readFileSync(workshopMigrationPath, "utf8");
  const getWorkshopFunction = name => workshopSql.match(new RegExp(
    "create\\s+or\\s+replace\\s+function\\s+public\\." + name + "[\\s\\S]*?\\$function\\$;",
    "i"
  ))?.[0] ?? null;
  const workshopFunctions = [
    ["admin_get_workshop", "admin"],
    ["admin_upsert_workshop", "admin"],
    ["client_list_workshop_registrations", "client"],
    ["client_submit_workshop_payment_reference", "client"]
  ];
  for (const [name, role] of workshopFunctions) {
    const body = getWorkshopFunction(name);
    if (!body) { errors.push("Missing workshop RPC: " + name); continue; }
    if (!/security\s+definer/i.test(body) || !/set\s+search_path\s*=\s*''/i.test(body)) {
      errors.push(name + " must be a pinned SECURITY DEFINER RPC");
    }
    if (role === "admin" && (!/require_admin_aal2\(\)/i.test(body) || !/role\s*=\s*'admin'/i.test(body))) {
      errors.push(name + " must require admin role and AAL2");
    }
    if (role === "client" && !/role\s*=\s*'client'/i.test(body)) {
      errors.push(name + " must enforce the client role");
    }
  }
  if (!/case\s+when\s+w\.fee_amount\s*=\s*0\s+or\s+r\.status\s*=\s*'paid'\s+then\s+w\.meeting_url\s+else\s+null/i.test(workshopSql) ||
      !/case\s+when\s+w\.fee_amount\s*=\s*0\s+or\s+r\.status\s*=\s*'paid'\s+then\s+w\.meeting_password\s+else\s+null/i.test(workshopSql)) {
    errors.push("Workshop meeting credentials must be hidden until free registration or confirmed payment");
  }
  for (const signature of [
    "admin_get_workshop(uuid)",
    "client_list_workshop_registrations()",
    "client_submit_workshop_payment_reference(uuid,text)"
  ]) {
    const escapedSignature = signature.replaceAll("(", "\\(").replaceAll(")", "\\)");
    const pattern = new RegExp("revoke\\s+all\\s+on\\s+function\\s+public\\." + escapedSignature + "\\s+from\\s+public,\\s*anon", "i");
    if (!pattern.test(workshopSql)) errors.push("Workshop RPC must revoke public/anon execution: " + signature);
  }
}


const intakeMigrationPath = path.join(process.cwd(), "supabase", "migrations", "20261116154010_gate_client_intake_until_policy_approval.sql");
if (!fs.existsSync(intakeMigrationPath)) {
  errors.push("Missing fail-closed client intake migration");
} else {
  const intakeSql = fs.readFileSync(intakeMigrationPath, "utf8");
  if (!/client_intake_enabled','false'::jsonb/i.test(intakeSql)) errors.push("Client intake must default to disabled");
  if (!/admin_set_client_intake[\s\S]*?require_admin_aal2\(\)/i.test(intakeSql)) errors.push("Client intake setting must be admin AAL2 protected");
  if (!/approved_policy_version_required/i.test(intakeSql) || !/v_version ilike '%draft%'/i.test(intakeSql)) errors.push("Client intake must reject draft policy versions");
  if (!/client_intake_paused/i.test(intakeSql) || !/p_policy_version is distinct from v_required_policy/i.test(intakeSql)) errors.push("Client request RPC must enforce server-side intake and policy gates");
  if (!/revoke all on function public\.create_client_request_with_consent\(uuid,text,text,text,text,boolean,text,text,uuid\) from public,anon/i.test(intakeSql)) errors.push("Slot-aware client request RPC must not be executable by anonymous users");
}
const legacyConsentMigrationPath = path.join(process.cwd(), "supabase", "migrations", "20261116154154_revoke_legacy_consent_request_overload.sql");
if (!fs.existsSync(legacyConsentMigrationPath) || !/revoke all on function public\.create_client_request_with_consent\(uuid,text,text,text,text,boolean,text,text\) from public,anon,authenticated/i.test(fs.readFileSync(legacyConsentMigrationPath, "utf8"))) {
  errors.push("Legacy eight-argument consent RPC overload must be revoked");
}

if (errors.length) {
  console.error("Schema guardrail check failed:\n" + errors.map(error => "- " + error).join("\n"));
  process.exit(1);
}
console.log("Schema guardrail check passed: RLS, controlled RPCs, pinned search_path and restricted browser writes.");
console.log("Static check only; this does not replace PostgreSQL/Supabase runtime or penetration testing.");
