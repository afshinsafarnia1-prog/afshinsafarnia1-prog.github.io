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

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await page.locator("#siteLanguage").selectOption("en");
  await page.waitForFunction(() => document.documentElement.lang === "en" && document.documentElement.dir === "ltr");
  const hero = await page.locator(".hero h1").innerText();
  if (!hero.includes("Understanding what is happening")) throw new Error("Homepage English translation did not apply.");

  await page.goto("http://127.0.0.1:4173/client.html", { waitUntil: "domcontentloaded" });
  await page.locator("#siteLanguage").selectOption("en");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  const clientHeading = await page.locator("h1").textContent();
  if (!clientHeading.includes("Client area")) throw new Error("Client page English translation did not apply.");

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
  console.log("PASS: 10 pages return HTTP 200; homepage and client language switch; manifest and service worker load; no uncaught page errors.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
