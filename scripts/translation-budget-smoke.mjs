import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { MONTHLY_LIMIT, billingPeriod, readBudget, remainingBudget, recordUsage } from "./translation-budget.mjs";

const root = await mkdtemp(join(tmpdir(), "radyad-translation-budget-"));
try {
  assert.equal(MONTHLY_LIMIT, 450000);
  // The Pacific month boundary must be respected even when UTC is already
  // on the first day of the next month.
  assert.equal(billingPeriod(new Date("2026-12-01T07:59:59.000Z")), "2026-11");
  assert.equal(billingPeriod(new Date("2026-12-01T08:00:00.000Z")), "2026-12");

  const initial = await readBudget(root);
  assert.equal(initial.used, 0);
  await recordUsage(root, 400000);
  assert.equal(await remainingBudget(root), 50000);
  await assert.rejects(() => recordUsage(root, 50001), /Monthly translation safety limit reached/);
  assert.equal(await remainingBudget(root), 50000);

  const ledger = resolve(root, "auto-translations", "monthly-budget.json");
  await mkdir(resolve(root, "auto-translations"), { recursive: true });
  await writeFile(ledger, "{broken", "utf8");
  await assert.rejects(() => remainingBudget(root), /refusing provider calls to protect the free-tier cap/);
  console.log("Monthly translation budget smoke test passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
