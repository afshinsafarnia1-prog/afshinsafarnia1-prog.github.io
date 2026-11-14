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
    "/", "/client.html", "/admin.html", "/therapist.html",
    "/assistant.html", "/rules.html", "/articles/",
    "/articles/psychotherapy-first-session.html",
    "/articles/therapeutic-relationship.html",
    "/articles/ai-robots-human-meaning.html"
  ];
  for (const path of pages) {
    const response = await page.goto("http://127.0.0.1:4173" + path, { waitUntil: "domcontentloaded" });
    if (!response || response.status() !== 200) throw new Error(`Page failed: ${path} (${response?.status()})`);
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
  }
  const englishHero = await page.locator(".hero h1").innerText();
  if (!englishHero.includes("Understanding what is happening")) throw new Error("Homepage English translation did not apply.");

  await page.goto("http://127.0.0.1:4173/client.html", { waitUntil: "domcontentloaded" });
  for (const language of languages) {
    await page.locator("#siteLanguage").selectOption(language);
    await page.waitForFunction(value => document.documentElement.lang === value, language);
    const clientHeading = await page.locator("h1").textContent();
    if (!clientHeading?.trim()) throw new Error("Client heading is empty for " + language);
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

  if (pageErrors.length) throw new Error("Browser runtime errors: " + pageErrors.join(" | "));
  console.log("PASS: 10 pages return HTTP 200; all eight homepage/client languages, assistant, therapist, article-index and Persian-only notices work; PWA assets load; no uncaught page errors.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
