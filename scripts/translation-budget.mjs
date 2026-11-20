import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

export const MONTHLY_LIMIT = Number(process.env.MAX_TRANSLATION_CHARS_PER_MONTH || 450000);
const budgetPath = root => resolve(root, "auto-translations", "monthly-budget.json");

// Google Cloud monthly usage is aligned to the Pacific calendar month.
// Use the same boundary for the local ledger so a UTC midnight cannot reset
// the safety cap several hours before Google's free allowance resets.
export function billingPeriod(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  return `${year}-${month}`;
}

export const characterCount = values => values.reduce((sum, value) => sum + Array.from(String(value || "")).length, 0);

export async function readBudget(root) {
  const period = billingPeriod();
  let data;
  try {
    data = JSON.parse(await readFile(budgetPath(root), "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new Error(`Translation budget ledger is unreadable; refusing provider calls to protect the free-tier cap: ${error.message}`);
    }
  }
  if (!data || data.period !== period) data = { schemaVersion: 1, period, limit: MONTHLY_LIMIT, used: 0 };
  if (!Number.isFinite(Number(data.used)) || Number(data.used) < 0) {
    throw new Error("Translation budget ledger has an invalid usage count; refusing provider calls.");
  }
  data.limit = MONTHLY_LIMIT;
  data.used = Math.ceil(Number(data.used));
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
