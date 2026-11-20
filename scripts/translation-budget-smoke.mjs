import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MONTHLY_LIMIT, readBudget, remainingBudget, recordUsage } from "./translation-budget.mjs";

const root = await mkdtemp(join(tmpdir(), "radyad-translation-budget-"));
try {
  assert.equal(MONTHLY_LIMIT, 450000);
  const initial = await readBudget(root);
  assert.equal(initial.used, 0);
  await recordUsage(root, 400000);
  assert.equal(await remainingBudget(root), 50000);
  await assert.rejects(() => recordUsage(root, 50001), /Monthly translation safety limit reached/);
  assert.equal(await remainingBudget(root), 50000);
  console.log("Monthly translation budget smoke test passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
