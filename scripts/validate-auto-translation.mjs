import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await readFile(resolve(root, "scripts/auto-translation-manifest.json"), "utf8"));
const expected = ["ku", "en", "tr", "ar", "es", "de", "fr"];
if (JSON.stringify(Object.keys(manifest.targets).sort()) !== JSON.stringify(expected.slice().sort())) {
  throw new Error("Automatic translation manifest must cover all seven non-Persian locales.");
}
for (const block of manifest.blocks) {
  const source = await readFile(resolve(root, block.file), "utf8");
  const start = `<!-- RADYAD_AUTO_TRANSLATE:${block.id}:START -->`;
  const end = `<!-- RADYAD_AUTO_TRANSLATE:${block.id}:END -->`;
  const open = `data-auto-translate-block="${block.id}"`;
  if (!source.includes(open) || !source.includes(start) || !source.includes(end) || source.indexOf(start) > source.indexOf(end)) {
    throw new Error(`Automatic translation block is not correctly marked: ${block.file}`);
  }
  const runtimePath = block.file.startsWith("articles/") ? "../auto-translate-runtime.js" : "auto-translate-runtime.js";
  if (!source.includes(runtimePath)) throw new Error(`Automatic translation runtime is not connected: ${block.file}`);
  console.log(`Translation source verified: ${block.id}`);
}
console.log("Automatic translation manifest and source markers are valid.");
