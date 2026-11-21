import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const htmlFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", ".github"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) htmlFiles.push(full);
  }
}

walk(root);
const errors = [];
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const attrs = [...html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
  for (const raw of attrs) {
    if (!raw || raw.startsWith("#") || /^(https?:|mailto:|tel:|data:|javascript:|blob:)/i.test(raw)) continue;
    let decoded;
    try {
      decoded = decodeURIComponent(raw.split("#")[0].split("?")[0]);
    } catch {
      errors.push(`${path.relative(root, file)}: malformed URL encoding: ${raw}`);
      continue;
    }
    if (!decoded) continue;
    const target = path.resolve(decoded.startsWith("/") ? root : path.dirname(file), decoded.startsWith("/") ? decoded.slice(1) : decoded);
    const relative = path.relative(root, target);
    if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
      errors.push(`${path.relative(root, file)}: path escapes site root: ${raw}`);
      continue;
    }
    if (!fs.existsSync(target) && !fs.existsSync(path.join(target, "index.html"))) {
      errors.push(`${path.relative(root, file)}: missing local asset/link: ${raw}`);
    }
  }
}

try {
  JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
} catch {
  errors.push("manifest.webmanifest is not valid JSON");
}

const sitemapPath = path.join(root, "sitemap.xml");
const robotsPath = path.join(root, "robots.txt");
if (!fs.existsSync(sitemapPath)) {
  errors.push("Missing sitemap.xml");
} else {
  const sitemap = fs.readFileSync(sitemapPath, "utf8");
  const canonicalSiteOrigin = "https://afshinsafarnia1-prog.github.io";
  if (!sitemap.includes("<loc>" + canonicalSiteOrigin + "/</loc>")) {
    errors.push("sitemap.xml must use the canonical GitHub Pages site origin");
  }
  const sitemapLocations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  if (sitemapLocations.some(url => !url.startsWith(canonicalSiteOrigin + "/") && url !== canonicalSiteOrigin)) {
    errors.push("sitemap.xml contains URLs outside the canonical site origin");
  }
  if (sitemap.includes("YOUR-DOMAIN.example")) errors.push("sitemap.xml still contains a placeholder domain");
  if (!sitemap.includes("<urlset") || !sitemap.includes("<loc>https://")) errors.push("sitemap.xml has no valid URL entries");
  for (const page of ["/psychology.html", "/psychotherapy.html", "/psychiatry.html", "/relationships.html", "/articles/choosing-a-therapist.html", "/assessment.html"]) {
    if (!sitemap.includes(page)) errors.push("sitemap.xml is missing public guide: " + page);
  }
  for (const privatePage of ["/admin.html", "/client.html"]) {
    if (sitemap.includes(privatePage)) errors.push("Private portal must not be included in sitemap: " + privatePage);
  }
}
if (!fs.existsSync(robotsPath)) {
  errors.push("Missing robots.txt");
} else {
  const robots = fs.readFileSync(robotsPath, "utf8");
  if (fs.existsSync(sitemapPath)) {
    const sitemap = fs.readFileSync(sitemapPath, "utf8");
    const locStart = sitemap.indexOf("<loc>");
    const locEnd = sitemap.indexOf("</loc>", locStart);
    const firstUrl = locStart >= 0 && locEnd > locStart ? sitemap.slice(locStart + 5, locEnd) : null;
    const expectedSitemapUrl = firstUrl ? (firstUrl.endsWith("/") ? firstUrl + "sitemap.xml" : firstUrl + "/sitemap.xml") : null;
    if (!expectedSitemapUrl || !robots.includes(expectedSitemapUrl)) {
      errors.push("robots.txt sitemap URL does not match the site's sitemap host");
    }
  }
}
for (const page of ["admin.html", "client.html"]) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  if (!html.includes('name="robots" content="noindex,nofollow"')) {
    errors.push(page + " must be excluded from search indexing");
  }
}

for (const file of ["auth.js", "supabase-config.js", "admin-workflow-extended.js", "client-workflow.js", "site-i18n.js", "therapist-profile.js", "client-extensions.js", "admin-extensions.js", "workshops.js", "scripts/validate-schema.mjs", "supabase/schema.sql", "supabase/upgrade-client-choice-payment-first.sql", "supabase/platform-completion-2026-11.sql", "sw.js"]) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`${file} is required`);
}
for (const file of [".env", ".env.production"]) {
  if (fs.existsSync(path.join(root, file))) errors.push(`${file} must never be committed`);
}


const homepage = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const requiredPage of ["initial-guidance.html","standards.html","workshops.html","articles/why-assessment-matters.html","articles/ai-robots-human-meaning.html"]) if (!fs.existsSync(path.join(root, requiredPage))) errors.push("Integrated redesign page is required: "+requiredPage);
const workshopSecurityMigration=path.join(root,"supabase/migrations/20261118111700_restrict_public_workshop_meeting_credentials.sql");
if(!fs.existsSync(workshopSecurityMigration)) errors.push("Workshop private meeting credential grant migration is required.");
else {const sql=fs.readFileSync(workshopSecurityMigration,"utf8");if(!sql.includes("revoke select on table public.workshops from public, anon, authenticated")||!sql.includes("grant select (")||!sql.includes("meeting_url, meeting_password")) errors.push("Workshop public grants must exclude private meeting credentials.");}
if (homepage.includes("elegant-otter-e1f7ef.netlify.app")) errors.push("Homepage social URLs must not point to the paused Netlify deployment.");
for (const requiredPage of ["initial-guidance.html","standards.html","workshops.html","articles/why-assessment-matters.html","articles/ai-robots-human-meaning.html"]) if (!fs.existsSync(path.join(root, requiredPage))) errors.push("Integrated redesign page is required: "+requiredPage);
if (homepage.includes("elegant-otter-e1f7ef.netlify.app")) errors.push("Homepage canonical/social URLs must not point to the paused Netlify deployment.");
if (!homepage.includes("yad-assessment-float") && !fs.readFileSync(path.join(root,"site-i18n.js"),"utf8").includes("yad-assessment-float")) errors.push("Persistent initial-guidance access must be installed globally.");
const adminPage = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const adminWorkflow = fs.readFileSync(path.join(root, "admin-workflow-extended.js"), "utf8");
const appScript = fs.readFileSync(path.join(root, "app.js"), "utf8");
for (const [condition, message] of [
  [!appScript.includes('get_public_therapist_fee_directory') && appScript.includes('therapist-profile.html?id='), "Homepage directory must omit fees and link to therapist profiles"],
  [fs.existsSync(path.join(root, "therapist-profile.html")), "Public therapist profile page must exist"],
  [fs.existsSync(path.join(root, "workshops.html")) && fs.existsSync(path.join(root, "workshops.js")), "Public workshop directory and loader must exist"],
  [appScript.includes('therapist-profile.html?id='), "Therapist directory cards must link to public profiles"],
  [homepage.includes('id="faq"') && homepage.includes('class="faq-list"'), "Homepage must include its practical FAQ section"],
  [homepage.includes('href="workshops.html"'), "Homepage must link to the full workshop directory"],
  [homepage.includes('id="modality"') && homepage.includes('id="therapistKeyword"') && homepage.includes('id="acceptingOnly"'), "Therapist directory must include approach, keyword and intake availability filters"],
  [appScript.includes("get_public_therapist_directory_metadata") && appScript.includes("accepting_new_clients"), "Therapist directory must read verified intake availability metadata"],
  [fs.readFileSync(path.join(root, "client.html"), "utf8").includes('id="yadAdultConfirm"') && fs.readFileSync(path.join(root, "client.html"), "utf8").includes('id="yadSessionCountry"') && fs.readFileSync(path.join(root, "client.html"), "utf8").includes('id="yadClientConsent"'), "Client request must require adult confirmation, session country and policy acknowledgement"],
  [fs.readFileSync(path.join(root, "client-workflow.js"), "utf8").includes("create_client_request_with_consent") && fs.readFileSync(path.join(root, "client-workflow.js"), "utf8").includes("p_adult_confirmation: true"), "Client request must use consent- and adult-gated RPC"],
  [fs.readFileSync(path.join(root, "client.html"), "utf8").includes('id="yadClientAppointments"') && fs.readFileSync(path.join(root, "client.html"), "utf8").includes('id="yadClientSupportForm"') && fs.readFileSync(path.join(root, "client.html"), "utf8").includes('id="yadClientNotificationsList"'), "Client portal must include sessions, support and notifications"],
  [adminPage.includes('id="yadSessionAccessAdmin"') && adminPage.includes('id="yadSupportAdmin"') && adminPage.includes('id="yadFeedbackAdmin"'), "Admin portal must include session access, support and feedback moderation"],
  [adminPage.includes('id="yadAvailabilityForm"') && adminPage.includes('id="yadAvailabilityTherapist"'), "Admin portal must include managed availability slots"],
  [fs.readFileSync(path.join(root, "client.html"), "utf8").includes('id="yadPreferredTime"') && fs.readFileSync(path.join(root, "client.html"), "utf8").includes('id="yadPreferredSlot"') && fs.readFileSync(path.join(root, "client-workflow.js"), "utf8").includes("client_list_available_slots") && fs.readFileSync(path.join(root, "client-workflow.js"), "utf8").includes("p_preferred_slot_id"), "Client request must support preferred availability slots and optional time windows"],
  [fs.readFileSync(path.join(root, "site-i18n.js"), "utf8").includes("modalityFilter") && fs.readFileSync(path.join(root, "site-i18n.js"), "utf8").includes("acceptingOnly"), "Therapist directory filters must have multilingual labels"],
  [fs.readFileSync(path.join(root, "supabase/platform-completion-2026-11.sql"), "utf8").includes("admin_set_appointment_meeting") && fs.readFileSync(path.join(root, "supabase/platform-completion-2026-11.sql"), "utf8").includes("admin_resolve_support_cancellation") && fs.readFileSync(path.join(root, "supabase/platform-completion-2026-11.sql"), "utf8").includes("client_submit_appointment_feedback"), "Platform completion migration must define private session, cancellation and feedback RPCs"],
  [fs.readFileSync(path.join(root, "sw.js"), "utf8").includes('"/client-extensions.js"') && fs.readFileSync(path.join(root, "sw.js"), "utf8").includes('"/admin-extensions.js"') && fs.readFileSync(path.join(root, "sw.js"), "utf8").includes('"/assessment-workflow.js"') && fs.readFileSync(path.join(root, "sw.js"), "utf8").includes('"/admin-assessment-workflow.js"'), "PWA cache must include client, admin and assessment workflow scripts"],
  [homepage.includes('articles/choosing-a-therapist.html'), "Homepage must link to the therapist-selection guide"],
  [(appScript.includes('.select("id,public_slug,display_name,headline,biography,specialties,modalities,languages,photo_path,manager_approved,verified_at")') || appScript.includes('const select="id,public_slug,display_name,headline,biography,specialties,modalities,languages,photo_path,manager_approved,verified_at"')), "Public therapist directory must request migrated public therapist profile fields"],
  [fs.readFileSync(path.join(root, "supabase/upgrade-client-choice-payment-first.sql"), "utf8").includes("add column if not exists photo_path"), "Therapist profile migration must define the public photo field"],
  [fs.readFileSync(path.join(root, "therapist-profile.js"), "utf8").includes('.select("id,public_slug,display_name,headline,biography,qualifications,specialties,languages,modalities,photo_path,manager_approved,verified_at")'), "Public therapist profile must request only migrated public profile fields"],
  [homepage.includes('id="internationalCurrency"') && homepage.includes('value="CAD"'), "Homepage must include EUR/USD/CAD selector"],
  [homepage.includes('id="yadPublicContacts"') && fs.readFileSync(path.join(root, "app.js"), "utf8").includes('["phone_number","تلفن",v=>"tel:"+v]'), "Homepage must display the admin-managed phone number"],
  [adminPage.includes('id="yadBusinessSettingsForm"'), "Admin must include public contact, branding and intake settings"],
  [adminPage.includes('id="yadAssessmentFeeAdminForm"') && adminPage.includes('id="yadAdminAssessmentRequests"'), "Admin must include paid assessment fee and request management"],
  [adminWorkflow.includes('admin_update_yad_public_contacts') && adminWorkflow.includes("p_contacts:contacts") && adminWorkflow.includes('phone_number:"yadContactPhone"'), "Admin workflow must save public phone and contacts through the scoped settings RPC"],
  [adminWorkflow.includes('admin_set_client_intake') && !adminWorkflow.includes('admin_update_yad_business_settings'), "Admin workflow must manage intake without requiring central therapy tariffs"],
  [adminWorkflow.includes('admin_set_assessment_specialist'), "Admin must be able to designate verified assessment specialists"],
  [appScript.includes('get_public_site_settings'), "Homepage must load public settings through the scoped RPC"],
  [!adminWorkflow.includes('admin_set_therapist_prices'), "Admin workflow must not override therapist-defined fees"],
  [!appScript.includes('get_public_therapist_fee_directory'), "Public directory must not load or display therapist-specific fees"],
  [fs.readFileSync(path.join(root, "therapist-portal.js"), "utf8").includes("therapist_set_my_fee"), "Therapists must be able to set their own fees"],
  [fs.readFileSync(path.join(root, "therapist-profile.js"), "utf8").includes("get_public_therapist_fees"), "Therapist profiles must show their individual fees"],
  [fs.readFileSync(path.join(root, "client.html"), "utf8").includes('value="CAD"'), "Client booking must support CAD"],
  [fs.existsSync(path.join(root, "assessment.html")) && fs.existsSync(path.join(root, "assessment-workflow.js")), "Paid external assessment service page and workflow must exist"],
  [fs.readFileSync(path.join(root, "assessment-workflow.js"), "utf8").includes("client_create_assessment_request") && fs.readFileSync(path.join(root, "assessment-workflow.js"), "utf8").includes("p_adult_confirmation:true"), "Assessment requests must use the protected consent-gated RPC"],
  [fs.readFileSync(path.join(root, "admin-assessment-workflow.js"), "utf8").includes("admin_update_assessment_request"), "Admin must review assessment payments and schedule external sessions"],
  [fs.readFileSync(path.join(root, "site-i18n.js"), "utf8").includes("Evaluación de personalidad con STIPO y SWAP"), "Assessment page must include Spanish translations"],
  [adminPage.includes('id="yadDuration" type="number" min="45" max="45" value="45" readonly'), "Admin therapist form must enforce the 45-minute standard session"],
  [adminWorkflow.includes("p_session_duration_minutes: 45"), "Therapist profile saves must use the central 45-minute session duration"],
  [adminPage.includes('id="yadAuthority" maxlength="240"') && adminWorkflow.includes('p_issuing_authority: val("yadAuthority").trim()'), "Therapist licensing authority must be editable and stored per jurisdiction"],
  [adminWorkflow.includes("p_fee_amount: 0") && adminWorkflow.includes('p_fee_currency: "IRR"') && !adminWorkflow.includes('val("yadFee")') && !adminWorkflow.includes('val("yadCurrency")'), "Therapist profile saves must not depend on removed per-therapist fee fields"],
  [adminWorkflow.includes("Intl.DateTimeFormat().resolvedOptions().timeZone"), "Workshop timezone must default to the administrator device timezone"],
  [!adminWorkflow.includes('"Europe/Berlin"'), "Workshop scheduling must not hard-code a Berlin timezone"],
  [fs.existsSync(path.join(root, "therapist-articles.js")) && fs.readFileSync(path.join(root, "therapist.html"), "utf8").includes('id="yadTherapistArticleForm"'), "Therapists must have an authenticated article submission form"],
  [fs.existsSync(path.join(root, "admin-articles.js")) && fs.readFileSync(path.join(root, "admin.html"), "utf8").includes('id="yadAdminArticles"'), "Admin must have an MFA-protected article moderation interface"],
  [fs.existsSync(path.join(root, "articles/contributor-articles.js")) && fs.readFileSync(path.join(root, "articles/index.html"), "utf8").includes('id="yadContributorArticles"'), "Public article index must display only approved therapist submissions"],
  [fs.readFileSync(path.join(root, "sw.js"), "utf8").includes('"/therapist-articles.js"') && fs.readFileSync(path.join(root, "sw.js"), "utf8").includes('"/admin-articles.js"') && fs.readFileSync(path.join(root, "sw.js"), "utf8").includes('"/articles/contributor-articles.js"'), "PWA cache must include therapist article submission, moderation and public reader scripts"],
  [fs.existsSync(path.join(root, "supabase/migrations/20261117000500_add_moderated_therapist_articles.sql")), "Moderated therapist article workflow migration must be present"],
  [fs.existsSync(path.join(root, "supabase/migrations/20261119155551_therapist_article_revision_resubmission.sql")) && fs.readFileSync(path.join(root, "therapist-articles.js"), "utf8").includes("therapist_resubmit_article"), "Therapist article revision requests must support secure resubmission"],
  [fs.existsSync(path.join(root, "supabase/migrations/20261119155727_require_approved_therapist_for_article_publication.sql")), "Article publication must require manager-approved therapist profiles"],
  [fs.existsSync(path.join(root, "supabase/migrations/20261119155802_include_published_slug_in_therapist_article_status.sql")), "Therapist article status list must return the public article permalink"],
  [fs.readFileSync(path.join(root, "rules.html"), "utf8").includes("2026-11-17-v2-draft") && fs.readFileSync(path.join(root, "rules.html"), "utf8").includes("پیش‌نویس") && fs.readFileSync(path.join(root, "rules.html"), "utf8").includes("رضایت آگاهانهٔ درمان"), "Legal and privacy notice must be versioned, explicitly draft and distinguish platform consent from clinical consent"],
  [fs.readFileSync(path.join(root, "client-workflow.js"), "utf8").includes("2026-11-17-v2-draft") && fs.readFileSync(path.join(root, "admin-workflow-extended.js"), "utf8").includes("2026-11-17-v2-draft"), "Client and admin consent workflows must use the current draft policy version"],
  [fs.readFileSync(path.join(root, "client.html"), "utf8").includes("جایگزین رضایت آگاهانهٔ جداگانه برای شروع درمان نیست"), "Client request consent must not be represented as clinical informed consent"],
]) if (!condition) errors.push(message);
for (const file of ["supabase/migrations/20261116184730_require_verified_therapist_for_intake.sql", "supabase/migrations/20261116195646_therapist_specific_fees_and_cad_currency.sql", "supabase/migrations/20261116195852_paid_external_personality_assessment_workflow.sql", "supabase/migrations/20261116201500_add_admin_managed_public_phone_number.sql", "supabase/migrations/20261116202000_allow_jurisdiction_specific_therapist_license_authority.sql"]) {
  if (!fs.existsSync(path.join(root, file))) errors.push(file + " is required");
}


const guideTranslationScript = path.join(root, "service-guides-i18n.js");
if (!fs.existsSync(guideTranslationScript)) errors.push("service-guides-i18n.js is required");
else {
  const guideScript = fs.readFileSync(guideTranslationScript, "utf8");
  for (const [page, counts] of Object.entries({
    "psychology.html": { h2: 5, h3: 6, p: 12, li: 3 },
    "psychotherapy.html": { h2: 5, h3: 7, p: 16, li: 9 },
    "psychiatry.html": { h2: 5, h3: 3, p: 11, li: 3 },
    "relationships.html": { h2: 6, h3: 4, p: 11, li: 8 }
  })) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    if (!html.includes('data-guide-content="' + page.replace(".html", "") + '"')) errors.push(page + " must expose its translation key");
    if (!html.includes('src="service-guides-i18n.js"')) errors.push(page + " must load the service guide translation script");
    for (const [tag, expected] of Object.entries(counts)) {
      const article = html.match(/<article class="content-main"[^>]*>([\s\S]*?)<\/article>/);
      const actual = article ? [...article[1].matchAll(new RegExp("<" + tag + "\\b", "g"))].length : -1;
      if (actual !== expected) errors.push(page + " expected " + expected + " " + tag + " elements; found " + actual);
    }
    if (!guideScript.includes('"' + page.replace(".html", "") + '":{')) errors.push("English guide translation missing: " + page);
  }
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  if (!sw.includes('"/service-guides-i18n.js"')) errors.push("Service guide translations must be included in the offline cache");
}


const intakeMigration = path.join(root, "supabase", "migrations", "20261116184730_require_verified_therapist_for_intake.sql");
if (!fs.existsSync(intakeMigration)) errors.push("Client intake safety migration is required");
if (!adminPage.includes('id="yadClientIntakeEnabled"') || !adminPage.includes('id="yadClientPolicyVersion"')) errors.push("Admin must expose the legal-policy intake switch");
if (!fs.readFileSync(path.join(root, "client.html"), "utf8").includes('id="yadClientIntakeNotice"')) errors.push("Client page must disclose whether intake is open");
if (!adminWorkflow.includes('admin_set_client_intake')) errors.push("Admin workflow must save intake state through the protected RPC");
if (!adminWorkflow.includes('admin_update_yad_public_contacts')) errors.push("Admin workflow must allow public contacts to be saved before tariffs are configured");
if (!adminWorkflow.includes('admin_set_client_intake') || adminWorkflow.includes('هر سه تعرفه')) errors.push("Intake must use the protected release gate and must not require central therapy tariffs");
if (!fs.readFileSync(path.join(root, "client-workflow.js"), "utf8").includes("client_intake_paused")) errors.push("Client workflow must fail closed when intake is paused");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Static site check passed: ${htmlFiles.length} HTML pages, local links/assets and PWA manifest.`);
