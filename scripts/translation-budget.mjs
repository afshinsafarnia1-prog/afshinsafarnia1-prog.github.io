import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

export const MONTHLY_LIMIT = Number(process.env.MAX_TRANSLATION_CHARS_PER_MONTH || 450000);
const budgetPath = root => resolve(root, "auto-translations", "monthly-budget.json");
export const characterCount = values => values.reduce((sum, value) => sum + Array.from(String(value || "")).length, 0);

export async function readBudget(root) {
  const period = new Date().toISOString().slice(0, 7);
  let data = null;
  try { data = JSON.parse(await readFile(budgetPath(root), "utf8")); } catch {}
  if (!data || data.period !== period) data = { schemaVersion: 1, period, limit: MONTHLY_LIMIT, used: 0 };
  data.limit = MONTHLY_LIMIT;
  data.used = Math.max(0, Number(data.used) || 0);
  return data;
}

export async function remainingBudget(root) {
  const data = await readBudget(root);
  return Math.max(0, data.limit - data.used);
}

export async function recordUsage(root, chars) {
  const data = await readBudget(root);
  const count = Math.max(0, Math.ceil(chars));
  if (data.used + count > data.limit) {
    throw new Error(`Monthly translation safety limit reached: ${data.used} + ${count} > ${data.limit} characters.`);
  }
  data.used += count;
  await mkdir(resolve(root, "auto-translations"), { recursive: true });
  await writeFile(budgetPath(root), JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2) + "\n", "utf8");
  console.log(`Translation budget ${data.period}: ${data.used}/${data.limit} characters used.`);
}
