import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".github") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".html")) htmlFiles.push(full);
  }
}
walk(root);
const errors = [];
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const attrs = [...html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  for (const raw of attrs) {
    if (!raw || raw.startsWith("#") || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(raw)) continue;
    const clean = decodeURIComponent(raw.split("#")[0].split("?")[0]);
    if (!clean) continue;
    const target = clean.startsWith("/")
      ? path.join(root, clean.replace(/^\/+/, ""))
      : path.resolve(path.dirname(file), clean);
    if (!target.startsWith(root + path.sep) && target !== root) {
      errors.push(`${path.relative(root,file)}: path escapes site root: ${raw}`);
      continue;
    }
    const exists = fs.existsSync(target) || fs.existsSync(path.join(target, "index.html"));
    if (!exists) errors.push(`${path.relative(root,file)}: missing local asset/link: ${raw}`);
  }
}
try { JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8")); }
catch { errors.push("manifest.webmanifest is not valid JSON"); }
for (const file of [".env", ".env.production"]) {
  if (fs.existsSync(path.join(root,file))) errors.push(`${file} must never be committed`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Static site check passed: ${htmlFiles.length} HTML pages, local links/assets and PWA manifest.`);
