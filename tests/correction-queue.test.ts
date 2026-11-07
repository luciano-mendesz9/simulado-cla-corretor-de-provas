import { test } from "node:test";
import assert from "node:assert/strict";
import { runPool } from "../src/lib/correction-queue";

for (const total of [1, 10, 30]) test(`batch processes ${total} images with two active operations`, async () => {
  let active = 0, peak = 0;
  const results = await runPool(Array.from({ length: total }, (_, i) => i), 2, async index => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--;
    if (index === 3) throw new Error("Arquivo inválido");
    return index;
  });
  assert.equal(results.length, total);
  assert.ok(peak <= 2);
  if (total >= 4) {
    assert.equal(results[3].status, "rejected");
    assert.equal(results.filter(result => result.status === "fulfilled").length, total - 1);
    const retried = await runPool([3], 2, async () => "recuperado");
    assert.deepEqual(retried, [{ status: "fulfilled", value: "recuperado" }]);
  } else assert.equal(results[0].status, "fulfilled");
});
