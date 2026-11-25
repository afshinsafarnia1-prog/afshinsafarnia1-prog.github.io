import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    let target = resolve(root, relative);
    if (target !== root && !target.startsWith(root + sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const stat = await import("node:fs/promises").then(fs => fs.stat(target));
      if (stat.isDirectory()) target = resolve(target, "index.html");
    } catch {}
    const body = await readFile(target);
    res.writeHead(200, { "content-type": mime[extname(target)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
});

await new Promise(resolveListen => server.listen(4173, "127.0.0.1", resolveListen));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(`${page.url()} :: ${error.stack || error.message}`));
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:4173") return route.continue();
    if (url.hostname === "dszwzoiqgslnbnmryajs.supabase.co" && url.pathname.startsWith("/rest/v1/")) {
      const therapist = {id:"449e7b02-e14f-4c83-946f-7aff706d0c53",public_slug:"foruzan-shahla",display_name:"فروزان شهلا",headline:"روان‌درمانگر تحلیلی",biography:"معرفی آزمایشی برای آزمون فهرست عمومی",specialties:["روان‌درمانی تحلیلی"],modalities:["online","in_person"],languages:["fa","en"],photo_path:null,manager_approved:true,verified_at:null};
      let body = [];
      if (url.pathname.endsWith("/therapists")) body = [therapist];
      else if (url.pathname.endsWith("/rpc/get_public_therapist_fee_directory")) body = [];
      else if (url.pathname.endsWith("/rpc/get_public_therapist_directory_metadata")) body = [];
      else if (url.pathname.endsWith("/rpc/get_public_therapist_rating_summary")) body = [];
      else if (url.pathname.endsWith("/rpc/get_public_site_settings")) body = {contacts:{},branding:{},tariffs:[]};
      else return route.fulfill({status:404,contentType:"application/json",body:JSON.stringify({message:"Mock endpoint not found"})});
      return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"GET,POST,OPTIONS"},body:JSON.stringify(body)});
    }
    return route.abort();
  });

  const pages = [
    "/", "/contact.html", "/relationships.html", "/psychology.html", "/psychotherapy.html", "/psychiatry.html", "/client.html", "/admin.html", "/therapist.html",
    "/assistant.html", "/rules.html", "/articles/", "/articles/choosing-a-therapist.html", "/workshops.html",
    "/articles/psychotherapy-first-session.html",
    "/articles/therapeutic-relationship.html",
    "/articles/ai-robots-human-meaning.html", "/therapists/foruzan-shahla.html"
  ];
  for (const path of pages) {
    const response = await page.goto("http://127.0.0.1:4173" + path, { waitUntil: "domcontentloaded" });
    if (!response || response.status() !== 200) throw new Error(`Page failed: ${path} (${response?.status()})`);
  }

  await page.goto("http://127.0.0.1:4173/articles/", { waitUntil: "domcontentloaded" });
  if (!(await page.locator("h1").innerText()).includes("مقالات تحلیلی")) throw new Error("Journal landing page heading is incorrect.");
  if (!(await page.locator("#yadContributorArticles").count())) throw new Error("Contributor articles section is missing from the journal.");
  await page.goto("http://127.0.0.1:4173/articles/choosing-a-therapist.html", { waitUntil: "domcontentloaded" });
  if (!(await page.locator("h1").innerText()).includes("درمانگر")) throw new Error("Therapist-selection guide did not render.");
  await page.goto("http://127.0.0.1:4173/workshops.html", { waitUntil: "domcontentloaded" });
  if (!(await page.locator("h1").innerText()).includes("کارگاه")) throw new Error("Workshops landing page did not render.");
  if (await page.locator('.portal-nav a[href="client.html"]').count()) throw new Error("Client portal must not appear in the public workshops navigation.");
  await page.setViewportSize({width:360,height:800});
  await page.waitForTimeout(100);
  const workshopMobile = await page.evaluate(() => ({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,heading:document.querySelector("h1").getBoundingClientRect().toJSON(),lead:document.querySelector(".section-head>p").getBoundingClientRect().toJSON()}));
  if (workshopMobile.scrollWidth > workshopMobile.width) throw new Error("Workshops page overflows horizontally on a 360px portrait viewport.");
  if (workshopMobile.heading.left < 0 || workshopMobile.heading.right > workshopMobile.width + 1 || workshopMobile.lead.left < 0 || workshopMobile.lead.right > workshopMobile.width + 1) throw new Error("Workshops heading or introduction is clipped on a portrait viewport.");
  await page.setViewportSize({width:1280,height:800});
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  for (const selector of ['.topline a[href="/articles/"]', '#mainNav a[href="/articles/"]', '#mainNav a[href="/workshops.html"]', 'a.navcta[href="/articles/choosing-a-therapist.html"]', '.footerlinks a[href="/articles/"]']) {
    if (!(await page.locator(selector).count())) throw new Error("Homepage journal/workshop route is missing: " + selector);
  }

  await page.goto("http://127.0.0.1:4173/admin.html", { waitUntil: "domcontentloaded" });
  if (!(await page.locator("#yadMfaBackup").count()) || !(await page.locator("#yadMfaFactor").count())) {
    throw new Error("Admin backup MFA enrollment or factor selection UI is missing.");
  }

  for (const [path, heading] of [["/relationships.html","زوج‌درمانی و خانواده‌درمانی"],["/psychology.html","روان‌شناسی و مشاوره"],["/psychotherapy.html","روان‌درمانی"],["/psychiatry.html","روان‌پزشکی"]]) {
    await page.goto("http://127.0.0.1:4173" + path, { waitUntil: "domcontentloaded" });
    if (!(await page.locator("h1").innerText()).includes(heading)) throw new Error("Service guide heading missing: " + path);
    if (await page.locator(".content-main .content-card").count() < 4) throw new Error("Service guide content is incomplete: " + path);
  }

  const languages = ["fa", "ku", "en", "tr", "ar", "es", "de", "fr"];
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await page.locator('.therapist-card[data-therapist-slug="foruzan-shahla"]').waitFor({timeout:10000});
  if (!(await page.locator(".therapist-card h3").filter({hasText:"فروزان شهلا"}).count())) throw new Error("Public therapist directory did not render the approved therapist through the REST fallback.");
  for (const language of languages) {
    await page.locator("#siteLanguage").selectOption(language);
    await page.waitForFunction(value => document.documentElement.lang === value, language);
    const direction = await page.locator("html").getAttribute("dir");
    const expectedDirection = ["fa", "ku", "ar"].includes(language) ? "rtl" : "ltr";
    if (direction !== expectedDirection) throw new Error("Homepage direction is wrong for " + language);
    const hero = await page.locator(".hero h1").textContent();
    if (!hero?.trim()) throw new Error("Homepage hero is empty for " + language);
    if (!(await page.locator('[data-i18n="modalityFilter"]').innerText()).trim()) throw new Error("Therapist approach filter did not localize for " + language);
    if (!(await page.locator('[data-i18n="acceptingOnly"]').innerText()).trim()) throw new Error("Therapist intake filter did not localize for " + language);
  }
  await page.locator("#siteLanguage").selectOption("en");
  const englishHero = await page.locator(".hero h1").innerText();
  if (!englishHero.includes("Understanding what is happening")) throw new Error("Homepage English translation did not apply.");
  const serviceLinks = await page.locator(".service-grid .service a").allTextContents();
  if (!serviceLinks[0].includes("Explore psychotherapy") || !serviceLinks[1].includes("Psychology guide") || !serviceLinks[3].includes("Psychiatry guide")) {
    throw new Error("Homepage service guide links did not localize into English.");
  }
  for (const [path, label] of [["/psychology.html","Psychotherapy"],["/psychotherapy.html","Psychology"],["/psychiatry.html","Psychotherapy"]]) {
    await page.goto("http://127.0.0.1:4173" + path, { waitUntil: "domcontentloaded" });
    await page.locator("#siteLanguage").selectOption("en");
    const navText = await page.locator(".navrow nav").innerText();
    if (!navText.includes("Home") || !navText.includes("Journal")) throw new Error("Service guide navigation did not localize: " + path);
  }

  await page.goto("http://127.0.0.1:4173/contact.html", { waitUntil: "domcontentloaded" });
  if (!(await page.locator('a[href="tel:+989999398350"]').count()) || !(await page.locator('a[href="https://wa.me/989999398350"]').count())) throw new Error("Public contact page is missing phone or WhatsApp links.");
  await page.goto("http://127.0.0.1:4173/client.html", { waitUntil: "domcontentloaded" });
  if (!(await page.locator("#yadBookingContact a[href=\"tel:+989999398350\"]").count()) || !(await page.locator("#yadBookingContact a[href=\"https://wa.me/989999398350\"]").count())) throw new Error("Client booking contact options are missing.");
  for (const selector of ["#yadClientConsent", "#yadAdultConfirm", "#yadSessionCountry", "#yadPreferredTime", "#yadClientAppointmentList", "#yadClientSupportForm", "#yadClientNotificationsList", "#yadExportMyData"]) {
    if (!(await page.locator(selector).count())) throw new Error("Client workflow control missing: " + selector);
  }
  if (await page.locator(".yad-quick-nav a").count() !== 6) throw new Error("Client quick navigation is incomplete.");
  for (const link of await page.locator(".yad-quick-nav a").evaluateAll(nodes => nodes.map(a => a.getAttribute("href")))) {
    if (!link?.startsWith("#") || !(await page.locator(link).count())) throw new Error("Client quick navigation target is missing: " + link);
  }
  const clientHtml = await readFile(resolve(root, "client.html"), "utf8");
  if (!clientHtml.includes("client-extensions.js")) throw new Error("Client extension script is not connected.");
  for (const language of languages) {
    await page.locator("#siteLanguage").selectOption(language);
    await page.waitForFunction(value => document.documentElement.lang === value, language);
    if (!(await page.locator("h1").innerText()).trim()) throw new Error("Client page heading is empty for " + language);
    if (!(await page.locator('[data-i18n="sessionCountry"]').innerText()).trim()) throw new Error("Client session-country label did not localize for " + language);
    if (!(await page.locator('[data-i18n="adultConfirm"]').innerText()).trim()) throw new Error("Client adult-confirmation label did not localize for " + language);
    if (!(await page.locator('[data-i18n="crisisNotice"]').innerText()).trim()) throw new Error("Client emergency boundary did not localize for " + language);
  }
  await page.goto("http://127.0.0.1:4173/admin.html", { waitUntil: "domcontentloaded" });
  for (const selector of ["#yadSessionAccessAdmin", "#yadSupportAdmin", "#yadFeedbackAdmin", "#yadAvailabilityForm", "#yadAvailabilityTherapist", "#yadYearsExperience", "#yadJurisdictions", "#yadAcceptingNewClients"]) {
    if (!(await page.locator(selector).count())) throw new Error("Admin workflow control missing: " + selector);
  }
  if (await page.locator(".admin-shortcuts a").count() !== 14) throw new Error("Admin quick navigation is incomplete.");
  if (await page.locator("#yadTherapistForm > details").count() !== 4) throw new Error("Therapist editor should have four guided sections.");
  if (await page.locator("#yadWorkshopAdminForm > details").count() !== 4) throw new Error("Workshop editor should have four guided sections.");
  for (const link of await page.locator(".admin-shortcuts a").evaluateAll(nodes => nodes.map(a => a.getAttribute("href")))) {
    if (!link?.startsWith("#") || !(await page.locator(link).count())) throw new Error("Admin quick navigation target is missing: " + link);
  }
  const workshopSection = page.locator("#yadWorkshopAdminForm > details").nth(1);
  await workshopSection.locator("summary").evaluate(summary => summary.click());
  if (!(await workshopSection.evaluate(el => el.open))) throw new Error("Workshop editor section did not expand.");
  const adminHtml = await readFile(resolve(root, "admin.html"), "utf8");
  if (!adminHtml.includes("admin-extensions.js")) throw new Error("Admin extension script is not connected.");
  for (const id of ["yadBrandLogoPreview", "yadManagerPhotoPreview"]) {
    if (!adminHtml.includes('id="' + id + '"')) throw new Error("Brand image preview is missing: " + id);
  }
  const brandingWorkflow = await readFile(resolve(root, "admin-workflow-extended.js"), "utf8");
  if (!brandingWorkflow.includes('bucket === "site-assets" ? "site-assets/" + generatedPath')) throw new Error("Brand image upload path does not match the secure branding RPC.");
  if (!brandingWorkflow.includes('bindImagePreview("yadBrandLogo","yadBrandLogoPreview")')) throw new Error("Brand logo live preview is not connected.");
  const publicApp = await readFile(resolve(root, "app.js"), "utf8");
  if (!publicApp.includes('node.querySelector(".brand-logo")')) throw new Error("Public header does not render the admin-managed brand logo.");
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  for (const selector of ["#modality", "#therapistKeyword", "#acceptingOnly", "#clearTherapistFilters"]) {
    if (!(await page.locator(selector).count())) throw new Error("Therapist directory filter missing: " + selector);
  }

  await page.goto("http://127.0.0.1:4173/assistant.html", { waitUntil: "domcontentloaded" });
  await page.locator("#siteLanguage").selectOption("en");
  if (!(await page.locator("h1").innerText()).includes("Where would you like to begin")) throw new Error("Assistant translation did not apply.");
  await page.addInitScript(() => {
    if (!["/admin.html", "/therapist.html"].includes(location.pathname)) return;
    const role = location.pathname === "/admin.html" ? "admin" : "therapist";
    let session = null;
    const resultFor = table => table === "profiles"
      ? { data: { role, display_name: "حساب آزمایشی" }, error: null }
      : table === "therapists" ? { data: null, error: null } : { data: [], error: null };
    const makeQuery = table => {
      const result = resultFor(table);
      const query = new Proxy({}, {
        get(_target, property) {
          if (property === "then") return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
          if (property === "maybeSingle" || property === "single") return () => Promise.resolve(result);
          return () => query;
        }
      });
      return query;
    };
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
          signInWithPassword: async ({ email }) => {
            session = { user: { id: "00000000-0000-4000-8000-000000000001", email } };
            return { data: { session }, error: null };
          },
          signOut: async () => { session = null; return { error: null }; },
          refreshSession: async () => ({ data: { session }, error: null }),
          mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal2" }, error: null }) }
        },
        from: table => makeQuery(table),
        rpc: async () => ({ data: [], error: null }),
        storage: { from: () => ({ upload: async () => ({ data: null, error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) }
      })
    };
  });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  for (const [href, heading, visibleSelector] of [
    ["/admin.html", "مدیر", ".admin-shortcuts"],
    ["/therapist.html", "درمانگر", "#therapistPrivatePortal"]
  ]) {
    const link = page.locator('#mainNav a[href="' + href + '"]');
    if (!(await link.count())) throw new Error("Homepage portal link is missing: " + href);
    await link.click();
    await page.locator("#yadLogin").waitFor({ state: "visible" });
    if (!(await page.locator(".auth-gate h2").innerText()).includes(heading)) throw new Error("Wrong login gate for " + href);
    await page.locator("#yadEmail").fill("test@example.invalid");
    await page.locator("#yadPassword").fill("TestPassword123!");
    await page.locator("#yadLogin").click();
    await page.locator(visibleSelector).waitFor({ state: "visible", timeout: 5000 });
    if (await page.locator("#yadSessionBar").count() !== 1) throw new Error("Authenticated session bar did not appear for " + href);
    if (href === "/therapist.html" && await page.locator("#therapistPrivatePortal").isHidden()) throw new Error("Therapist private portal stayed hidden after sign-in.");
    if (href === "/therapist.html") {
      if (await page.locator(".therapist-quick-nav a").count() !== 3) throw new Error("Therapist quick navigation is incomplete.");
      const therapistLinks = await page.locator(".therapist-quick-nav a").evaluateAll(nodes => nodes.map(a => a.getAttribute("href")));
      for (const target of therapistLinks) {
        if (!target?.startsWith("#") || !(await page.locator(target).count())) throw new Error("Therapist quick navigation target is missing: " + target);
      }
    }
    await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  }
  await page.goto("http://127.0.0.1:4173/therapist.html", { waitUntil: "domcontentloaded" });
  await page.locator("#siteLanguage").selectOption("en");
  if (!(await page.locator("h1").innerText()).includes("Therapist profiles")) throw new Error("Therapist page translation did not apply.");
  await page.goto("http://127.0.0.1:4173/articles/", { waitUntil: "domcontentloaded" });
  await page.locator("#siteLanguage").selectOption("en");
  if (!(await page.locator("h1").innerText()).includes("Psychotherapy articles")) throw new Error("Article index translation did not apply.");
  await page.goto("http://127.0.0.1:4173/rules.html", { waitUntil: "domcontentloaded" });
  await page.locator("#siteLanguage").selectOption("en");
  if (await page.locator("[data-i18n-show-non-fa]").isHidden()) throw new Error("Legal Persian-only notice was not shown for English.");
  await page.goto("http://127.0.0.1:4173/articles/psychotherapy-first-session.html", { waitUntil: "domcontentloaded" });
  await page.locator("#siteLanguage").selectOption("en");
  if (await page.locator("[data-i18n-show-non-fa]").isHidden()) throw new Error("Article Persian-only notice was not shown for English.");

  const manifest = await page.request.get("http://127.0.0.1:4173/manifest.webmanifest");
  if (!manifest.ok()) throw new Error("PWA manifest is not reachable.");
  const manifestJson = await manifest.json();
  if (!manifestJson.name || !manifestJson.start_url || !Array.isArray(manifestJson.icons) || !manifestJson.icons.length) {
    throw new Error("PWA manifest is missing required fields or app icons.");
  }
  for (const icon of manifestJson.icons) {
    const iconResponse = await page.request.get("http://127.0.0.1:4173" + icon.src);
    if (!iconResponse.ok()) throw new Error("PWA icon is not reachable: " + icon.src);
  }
  const sw = await page.request.get("http://127.0.0.1:4173/sw.js");
  if (!sw.ok()) throw new Error("Service worker is not reachable.");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await page.locator("#menuToggle").click();
  if (!(await page.locator("#mainNav").isVisible())) throw new Error("Mobile navigation did not open.");
  if (!(await page.locator(".therapist-filters").isVisible())) throw new Error("Mobile therapist filters are not visible.");
  const mobileFilterColumns = await page.locator(".therapist-filters").evaluate(el => getComputedStyle(el).gridTemplateColumns);
  if (mobileFilterColumns.split(" ").length !== 1) throw new Error("Therapist filters are not single-column on mobile.");
  if (await page.locator("#menuToggle").getAttribute("aria-expanded") !== "true") throw new Error("Mobile navigation expanded state was not announced.");
  await page.locator('#mainNav a[href="#services"]').click();
  if (await page.locator("#mainNav").isVisible()) throw new Error("Mobile navigation did not close after selecting a destination.");
  if (await page.locator("#menuToggle").getAttribute("aria-expanded") !== "false") throw new Error("Mobile navigation expanded state was not reset after closing.");
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  const navLabels = await page.locator("#mainNav a").allTextContents();
  if (navLabels.length !== 7 || navLabels[2].trim() !== "کارگاه‌ها" || navLabels[3].trim() !== "مجله" || navLabels[5].trim() !== "پنل درمانگر" || navLabels[6].trim() !== "مدیریت") {
    throw new Error("Homepage navigation labels do not match their destinations.");
  }
  if (await page.locator('#mainNav a[href="client.html"]').count()) throw new Error("Client portal must not appear in the public homepage navigation.");
  await page.goto("http://127.0.0.1:4173/admin.html", { waitUntil: "domcontentloaded" });
  if (!(await page.locator(".admin-shortcuts").count())) throw new Error("Admin quick-access navigation is missing.");
  if (!(await page.locator(".auth-gate").isVisible()) || !(await page.locator("#yadEmail").isVisible())) throw new Error("Admin login gate is not visible before authentication.");
  if (await page.locator(".admin-shortcuts").isVisible()) throw new Error("Admin data and shortcuts must remain hidden before authentication.");
  await page.goto("http://127.0.0.1:4173/therapist.html", { waitUntil: "domcontentloaded" });
  if (!(await page.locator(".auth-gate").isVisible()) || !(await page.locator("#yadEmail").isVisible())) throw new Error("Therapist login gate is not visible.");
  if (await page.locator("#therapistPrivatePortal").isVisible()) throw new Error("Private therapist portal must remain hidden before authentication.");

  for (const [path, selector] of [["/initial-guidance.html","#initialGuideForm"],["/standards.html","h1"],["/workshops.html","#yadWorkshopPageList"],["/articles/why-assessment-matters.html","h1"]]) {
    const response=await page.goto("http://127.0.0.1:4173"+path,{waitUntil:"domcontentloaded"});
    if(!response||response.status()!==200)throw new Error("Integrated page failed: "+path);
    if(!(await page.locator(selector).count()))throw new Error("Integrated page control missing: "+path+" "+selector);
  }
  await page.goto("http://127.0.0.1:4173/initial-guidance.html",{waitUntil:"domcontentloaded"});
  await page.locator("#guideSpecialty").selectOption("روان‌درمانی");
  await page.locator("#guideLanguage").selectOption("fa");
  await page.locator("#guideFormat").selectOption("online");
  await page.locator("#initialGuideForm button[type=submit]").click();
  await page.locator("#initialGuideResult a").click();
  await page.waitForURL(/index\.html\?[^#]*specialty=/);
  if(new URL(page.url()).searchParams.get("format")!=="online")throw new Error("Initial guide did not preserve the online preference.");
  await page.goto("http://127.0.0.1:4173/",{waitUntil:"domcontentloaded"});
  if(!(await page.locator(".yad-assessment-float").count()))throw new Error("Persistent initial-guidance link is missing.");
  if(!(await page.locator("#pwaInstallButton").count())||!(await page.locator("#pwaInstallHelp").count()))throw new Error("Mobile PWA installation entry point or help dialog is missing.");
  await page.locator("#pwaInstallButton").click();
  if(!(await page.locator("#pwaInstallHelp").isVisible()))throw new Error("PWA installation guidance dialog did not open.");
  await page.locator("#pwaInstallClose").click();
  await page.setViewportSize({width:390,height:844});
  await page.goto("http://127.0.0.1:4173/initial-guidance.html",{waitUntil:"domcontentloaded"});
  for(const path of ["/","/initial-guidance.html","/standards.html","/workshops.html"]){
    await page.goto("http://127.0.0.1:4173"+path,{waitUntil:"domcontentloaded"});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    if(overflow)throw new Error("Horizontal overflow on mobile: "+path);
  }
  await page.goto("http://127.0.0.1:4173/initial-guidance.html",{waitUntil:"domcontentloaded"});
  const floatContrast=await page.locator(".yad-assessment-float").evaluate(el=>{
    const parse=v=>{const m=v.match(/[0-9.]+/g);return m?.length>=3?m.slice(0,3).map(Number):[0,0,0];};
    const lum=v=>{const c=parse(v).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return .2126*c[0]+.7152*c[1]+.0722*c[2];};
    const style=getComputedStyle(el),a=lum(style.color),b=lum(style.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
  if(floatContrast<4.5)throw new Error("Persistent guidance button fails WCAG AA text contrast: "+floatContrast.toFixed(2));
  await page.goto("http://127.0.0.1:4173/rules.html",{waitUntil:"domcontentloaded"});
  const legalText=await page.locator(".legal").innerText();
  if(!legalText.includes("پیش‌نویس")||!legalText.includes("رضایت آگاهانهٔ درمان"))throw new Error("Legal draft disclosures are missing.");


  // Expanded small-screen checks for the primary public and portal journeys.
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of [
    "/", "/contact.html", "/initial-guidance.html", "/relationships.html", "/psychology.html",
    "/psychotherapy.html", "/psychiatry.html", "/therapist.html",
    "/client.html", "/admin.html", "/articles/ai-robots-human-meaning.html"
  ]) {
    const response = await page.goto("http://127.0.0.1:4173" + path, { waitUntil: "domcontentloaded" });
    if (!response || response.status() !== 200) throw new Error("Small-screen page failed: " + path);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth
    }));
    if (dimensions.document > dimensions.viewport + 1) {
      throw new Error("Small-screen horizontal overflow at 360px: " + path + " (" + dimensions.document + " > " + dimensions.viewport + ")");
    }
  }

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  const articleGuide = page.locator('a[href="articles/choosing-a-therapist.html"]');
  if (!(await articleGuide.count())) throw new Error("Homepage therapist-selection article link is missing.");
  const articleResponse = await page.request.get("http://127.0.0.1:4173/articles/choosing-a-therapist.html");
  if (articleResponse.status() !== 200) throw new Error("Therapist-selection article page failed to load.");

  if (pageErrors.length) throw new Error("Browser runtime errors: " + pageErrors.join(" | "));
  console.log("PASS: 18 pages and integrated guidance, standards, workshop and assessment content; initial-guide filter handoff; fixed mobile access; WCAG AA contrast for fixed CTA; legal draft disclosures; existing multilingual, portal, responsive and PWA smoke checks.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
