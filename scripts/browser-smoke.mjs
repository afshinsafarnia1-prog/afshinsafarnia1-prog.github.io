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
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.origin === "http://127.0.0.1:4173" ? route.continue() : route.abort();
  });

  const pages = [
    "/", "/relationships.html", "/psychology.html", "/psychotherapy.html", "/psychiatry.html", "/client.html", "/admin.html", "/therapist.html",
    "/assistant.html", "/rules.html", "/articles/",
    "/articles/psychotherapy-first-session.html",
    "/articles/therapeutic-relationship.html",
    "/articles/ai-robots-human-meaning.html"
  ];
  for (const path of pages) {
    const response = await page.goto("http://127.0.0.1:4173" + path, { waitUntil: "domcontentloaded" });
    if (!response || response.status() !== 200) throw new Error(`Page failed: ${path} (${response?.status()})`);
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

  await page.goto("http://127.0.0.1:4173/client.html", { waitUntil: "domcontentloaded" });
  for (const selector of ["#yadClientConsent", "#yadAdultConfirm", "#yadSessionCountry", "#yadPreferredTime", "#yadClientAppointmentList", "#yadClientSupportForm", "#yadClientNotificationsList", "#yadExportMyData"]) {
    if (!(await page.locator(selector).count())) throw new Error("Client workflow control missing: " + selector);
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
  const adminHtml = await readFile(resolve(root, "admin.html"), "utf8");
  if (!adminHtml.includes("admin-extensions.js")) throw new Error("Admin extension script is not connected.");
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  for (const selector of ["#modality", "#therapistKeyword", "#acceptingOnly", "#clearTherapistFilters"]) {
    if (!(await page.locator(selector).count())) throw new Error("Therapist directory filter missing: " + selector);
  }

  await page.goto("http://127.0.0.1:4173/assistant.html", { waitUntil: "domcontentloaded" });
  await page.locator("#siteLanguage").selectOption("en");
  if (!(await page.locator("h1").innerText()).includes("Where would you like to begin")) throw new Error("Assistant translation did not apply.");
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
  await page.waitForURL(/index\.html\?[^#]*specialty=/);
  if(new URL(page.url()).searchParams.get("format")!=="online")throw new Error("Initial guide did not preserve the online preference.");
  await page.goto("http://127.0.0.1:4173/",{waitUntil:"domcontentloaded"});
  if(!(await page.locator(".yad-assessment-float").count()))throw new Error("Persistent initial-guidance link is missing.");
  await page.setViewportSize({width:390,height:844});
  await page.goto("http://127.0.0.1:4173/initial-guidance.html",{waitUntil:"domcontentloaded"});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  if(overflow)throw new Error("Initial guidance page has horizontal overflow on mobile.");
  const floatContrast=await page.locator(".yad-assessment-float").evaluate(el=>{
    const parse=v=>{const m=v.match(/[\\d.]+/g);return m?.length>=3?m.slice(0,3).map(Number):[0,0,0];};
    const lum=v=>{const c=parse(v).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return .2126*c[0]+.7152*c[1]+.0722*c[2];};
    const style=getComputedStyle(el),a=lum(style.color),b=lum(style.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
  if(floatContrast<4.5)throw new Error("Persistent guidance button fails WCAG AA text contrast: "+floatContrast.toFixed(2));
  await page.goto("http://127.0.0.1:4173/rules.html",{waitUntil:"domcontentloaded"});
  const legalText=await page.locator(".legal").innerText();
  if(!legalText.includes("پیش‌نویس")||!legalText.includes("رضایت آگاهانهٔ درمان"))throw new Error("Legal draft disclosures are missing.");

  if (pageErrors.length) throw new Error("Browser runtime errors: " + pageErrors.join(" | "));
  console.log("PASS: 18 pages and integrated guidance, standards, workshop and assessment content; initial-guide filter handoff; fixed mobile access; WCAG AA contrast for fixed CTA; legal draft disclosures; existing multilingual, portal, responsive and PWA smoke checks.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
