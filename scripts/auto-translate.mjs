import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { characterCount, readBudget, remainingBudget, recordUsage } from "./translation-budget.mjs";

const root = process.cwd();
const key = process.env.GOOGLE_TRANSLATE_API_KEY;
if (!key) {
  console.error("GOOGLE_TRANSLATE_API_KEY is not configured. Automatic translations were not generated.");
  process.exit(2);
}
const manifest = JSON.parse(await readFile(resolve(root, "scripts/auto-translation-manifest.json"), "utf8"));
const targets = manifest.targets;
const hash = value => createHash("sha256").update(value).digest("hex");
const marker = id => ({
  start: `<!-- RADYAD_AUTO_TRANSLATE:${id}:START -->`,
  end: `<!-- RADYAD_AUTO_TRANSLATE:${id}:END -->`
});

function extract(html, id) {
  const m = marker(id);
  const start = html.indexOf(m.start);
  const end = html.indexOf(m.end);
  if (start < 0 || end < 0 || end <= start) throw new Error(`Translation markers missing or out of order: ${id}`);
  return html.slice(start + m.start.length, end).trim();
}

function metadata(html) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
  const meta = name => {
    const tag = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]*>`, "i"))?.[0];
    return tag?.match(/content=["']([^"']*)["']/i)?.[1] || "";
  };
  const property = name => {
    const tag = html.match(new RegExp(`<meta[^>]+property=["']${name}["'][^>]*>`, "i"))?.[0];
    return tag?.match(/content=["']([^"']*)["']/i)?.[1] || "";
  };
  return { title, description: meta("description"), ogTitle: property("og:title"), ogDescription: property("og:description"), twitterTitle: meta("twitter:title"), twitterDescription: meta("twitter:description") };
}

async function translate(values, target) {
  const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: values, source: manifest.sourceLanguage, target, format: "html" })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data?.data?.translations)) {
    throw new Error(`Google Cloud Translation failed (${response.status}): ${JSON.stringify(data.error || data).slice(0, 600)}`);
  }
  return data.data.translations.map(item => item.translatedText);
}

const maxChars = Number(process.env.MAX_TRANSLATION_CHARS_PER_MONTH || 450000);
let stopForBudget = false;
for (const block of manifest.blocks) {
  if (stopForBudget) break;
  const source = await readFile(resolve(root, block.file), "utf8");
  const html = extract(source, block.id);
  const meta = metadata(source);
  const sourceHash = hash(JSON.stringify({ html, meta }));
  const values = [html, meta.title, meta.description, meta.ogTitle, meta.ogDescription, meta.twitterTitle, meta.twitterDescription];
  const outputPath = resolve(root, "auto-translations", `${block.id}.json`);
  let previous = null;
  try { previous = JSON.parse(await readFile(outputPath, "utf8")); } catch {}
  const sameSource = previous?.sourceHash === sourceHash;
  const translations = sameSource ? { ...(previous.translations || {}) } : {};
  if (Object.keys(targets).every(locale => translations[locale])) {
    console.log(`Unchanged; cached translations retained: ${block.id}`);
    continue;
  }

  for (const [locale, providerCode] of Object.entries(targets)) {
    if (translations[locale]) continue;
    const cost = characterCount(values);
    const remaining = await remainingBudget(root);
    if (cost > remaining) {
      const budget = await readBudget(root);
      console.log(`Monthly translation budget reached (${budget.used}/${budget.limit}); remaining content deferred: ${block.id} -> ${locale}`);
      stopForBudget = true;
      break;
    }
    const output = await translate(values, providerCode);
    translations[locale] = {
      html: output[0],
      title: output[1],
      description: output[2],
      ogTitle: output[3],
      ogDescription: output[4],
      twitterTitle: output[5],
      twitterDescription: output[6]
    };
    await recordUsage(root, cost);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify({
      schemaVersion: 1,
      sourceLanguage: manifest.sourceLanguage,
      sourceHash,
      generatedAt: new Date().toISOString(),
      provider: "Google Cloud Translation",
      machineTranslated: true,
      translations
    }, null, 2) + "\n", "utf8");
    console.log(`Translated ${block.id} -> ${locale}`);
  }
}
