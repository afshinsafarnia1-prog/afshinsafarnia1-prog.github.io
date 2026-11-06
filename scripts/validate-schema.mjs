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

if (errors.length) {
  console.error("Schema guardrail check failed:\n" + errors.map(error => "- " + error).join("\n"));
  process.exit(1);
}
console.log("Schema guardrail check passed: RLS, controlled RPCs, pinned search_path and restricted browser writes.");
console.log("Static check only; this does not replace PostgreSQL/Supabase runtime or penetration testing.");
