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

for (const file of ["auth.js", "supabase-config.js", "scripts/validate-schema.mjs", "supabase/schema.sql", "sw.js"]) {
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
