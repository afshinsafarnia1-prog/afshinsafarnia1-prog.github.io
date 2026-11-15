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
  if (sitemap.includes("YOUR-DOMAIN.example")) errors.push("sitemap.xml still contains a placeholder domain");
  if (!sitemap.includes("<urlset") || !sitemap.includes("<loc>https://")) errors.push("sitemap.xml has no valid URL entries");
  for (const page of ["/psychology.html", "/psychotherapy.html", "/psychiatry.html", "/relationships.html"]) {
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
  if (!robots.includes("Disallow: /admin.html") || !robots.includes("Disallow: /client.html")) {
    errors.push("robots.txt must exclude private admin and client portals");
  }
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

for (const file of ["auth.js", "supabase-config.js", "admin-workflow.js", "client-workflow.js", "site-i18n.js", "scripts/validate-schema.mjs", "supabase/schema.sql", "supabase/upgrade-client-choice-payment-first.sql", "sw.js"]) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`${file} is required`);
}
for (const file of [".env", ".env.production"]) {
  if (fs.existsSync(path.join(root, file))) errors.push(`${file} must never be committed`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Static site check passed: ${htmlFiles.length} HTML pages, local links/assets and PWA manifest.`);
