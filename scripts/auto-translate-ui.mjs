import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, relative, resolve } from "node:path";

const root = process.cwd();
const dryRun = process.argv.includes("--dry-run");
const key = process.env.GOOGLE_TRANSLATE_API_KEY;
if (!key && !dryRun) {
  console.error("GOOGLE_TRANSLATE_API_KEY is not configured.");
  process.exit(2);
}
const targets = { ku: "ckb", en: "en", tr: "tr", ar: "ar", es: "es", de: "de", fr: "fr" };
const persian = /[\u0600-\u06FF]/;
const ignoredDirs = new Set([".git", "node_modules", "auto-translations", "supabase", "docs", ".github"]);
const ignoredFiles = new Set(["auto-translate-runtime.js", "therapist-profile.html"]);
const decodeEntities = value => value
  .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function add(set, value) {
  const text = decodeEntities(value).trim();
  if (text && persian.test(text) && text.length <= 5000) set.add(text);
}

function scanJsStrings(source, set) {
  let i = 0;
  while (i < source.length) {
    const quote = source[i];
    if (quote !== "'" && quote !== '"' && quote !== "`") { i++; continue; }
    i++;
    let chunk = "";
    let interpolated = false;
    while (i < source.length) {
      const ch = source[i];
      if (ch === "\\") {
        if (i + 1 < source.length) { chunk += source.slice(i, i + 2); i += 2; continue; }
      }
      if (quote === "`" && ch === "$" && source[i + 1] === "{") {
        interpolated = true;
        add(set, chunk.replace(/\\n/g, " ").replace(/\\t/g, " "));
        chunk = "";
        i += 2;
        let depth = 1, innerQuote = null;
        while (i < source.length && depth > 0) {
          const c = source[i];
          if (innerQuote) {
            if (c === "\\") { i += 2; continue; }
            if (c === innerQuote) innerQuote = null;
          } else if (c === "'" || c === '"' || c === "`") innerQuote = c;
          else if (c === "{") depth++;
          else if (c === "}") depth--;
          i++;
        }
        continue;
      }
      if (ch === quote) break;
      chunk += ch;
      i++;
    }
    if (quote === "`") add(set, chunk.replace(/\\n/g, " ").replace(/\\t/g, " "));
    else if (!interpolated) {
      let decoded = chunk;
      if (quote === '"') {
        try { decoded = JSON.parse('"' + chunk + '"'); } catch {}
      } else {
        decoded = chunk.replace(/\\'/g, "'").replace(/\\\\/g, "\\").replace(/\\n/g, " ").replace(/\\t/g, " ");
      }
      add(set, decoded);
    }
    i++;
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) files.push(...await walk(resolve(dir, entry.name)));
    } else if (entry.isFile() && (entry.name.endsWith(".html") || entry.name.endsWith(".js"))) {
      files.push(resolve(dir, entry.name));
    }
  }
  return files;
}

const strings = new Set();
const files = await walk(root);
for (const file of files) {
  const rel = relative(root, file).replaceAll("\\", "/");
  if (ignoredFiles.has(rel) || rel.startsWith("therapists/")) continue;
  const source = await readFile(file, "utf8");
  if (rel.endsWith(".html")) {
    let html = source
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<!-- RADYAD_AUTO_TRANSLATE:[^:]+:START -->[\s\S]*?<!-- RADYAD_AUTO_TRANSLATE:[^:]+:END -->/g, "");
    for (const match of html.matchAll(/>([^<>]+)</g)) add(strings, match[1]);
    for (const match of html.matchAll(/(?:placeholder|aria-label|title|alt|data-q)=["']([^"']+)["']/gi)) add(strings, match[1]);
    for (const match of html.matchAll(/<meta[^>]+content=[\x22\x27]([^\x22\x27]+)[\x22\x27][^>]*>/gi)) add(strings, match[1]);
  } else {
    scanJsStrings(source, strings);
  }
}

const list = [...strings].sort();
const sourceHash = createHash("sha256").update(JSON.stringify(list)).digest("hex");
const outputDir = resolve(root, "auto-translations");
const localeCaches = new Map();
for (const locale of Object.keys(targets)) {
  let previous = null;
  try { previous = JSON.parse(await readFile(resolve(outputDir, `dynamic-ui.${locale}.json`), "utf8")); } catch {}
  localeCaches.set(locale, new Map(previous?.translations || []));
}
const missingByLocale = new Map(
  [...localeCaches].map(([locale, cache]) => [locale, list.filter(value => !cache.has(value))])
);
const estimated = [...missingByLocale.values()].flat().reduce((sum, value) => sum + value.length, 0);
const missingCount = [...missingByLocale.values()].reduce((sum, values) => sum + values.length, 0);
const maxChars = Number(process.env.MAX_UI_TRANSLATION_CHARS_PER_RUN || 1000000);
console.log(`Found ${list.length} unique Persian UI/content strings; ${missingCount} locale-string entries need translation; estimated new translation input: ${estimated} characters.`);
if (estimated > maxChars) {
  if (dryRun) {
    console.warn(`Warning: estimate exceeds the safety limit (${maxChars}); the provider run will stop before making requests.`);
    process.exit(0);
  }
  throw new Error(`Dynamic UI translation estimate exceeds the safety limit (${maxChars}). Narrow the source set or split the update.`);
}
if (dryRun) process.exit(0);

async function translate(values, target) {
  const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: values, source: "fa", target, format: "text" })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data?.data?.translations)) {
    throw new Error(`Google Cloud Translation failed (${response.status}): ${JSON.stringify(data.error || data).slice(0, 500)}`);
  }
  return data.data.translations.map(item => item.translatedText);
}

function batches(values) {
  const output = [];
  let batch = [], chars = 0;
  for (const value of values) {
    if (batch.length && (batch.length >= 50 || chars + value.length > 20000)) {
      output.push(batch); batch = []; chars = 0;
    }
    batch.push(value); chars += value.length;
  }
  if (batch.length) output.push(batch);
  return output;
}

await mkdir(outputDir, { recursive: true });
for (const [locale, providerCode] of Object.entries(targets)) {
  const cache = localeCaches.get(locale);
  const missing = missingByLocale.get(locale);
  for (const batch of batches(missing)) {
    const output = await translate(batch, providerCode);
    output.forEach((translated, index) => cache.set(batch[index], translated));
  }
  const translations = list.map(value => [value, cache.get(value)]);
  await writeFile(resolve(outputDir, `dynamic-ui.${locale}.json`), JSON.stringify({
    schemaVersion: 1,
    sourceLanguage: "fa",
    targetLanguage: locale,
    sourceHash,
    generatedAt: new Date().toISOString(),
    provider: "Google Cloud Translation",
    machineTranslated: true,
    translations
  }, null, 2) + "\\n", "utf8");
  console.log(`Dynamic UI cache ready -> ${locale}; newly translated: ${missing.length}`);
}
