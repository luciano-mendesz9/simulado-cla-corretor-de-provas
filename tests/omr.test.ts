import { test } from "node:test";
import assert from "node:assert/strict";
import { makeCardQr } from "../src/lib/omr/card-qr";
import { recognizeCards, OmrFailure } from "../src/lib/omr";
import { overlayMarks } from "../src/components/corrections/correction-preview";

process.env.JWT_ACCESS_SECRET = "test-access-secret-0123456789-0123456789";
process.env.OMR_SHARED_SECRET = "test-internal-secret-0123456789012345";
process.env.OMR_SERVICE_URL = "http://127.0.0.1:8001/";
const examId = "08e6f6dd-197d-4ceb-bf67-399bfaadc101";
const studentId = "6307fb91-f892-4c08-a000-9c529f319101";
const answers = ["A", "B", "C", "D", "E"] as const;
const scores = { A: 0, B: 0, C: 0, D: 0, E: 0 };
const centers = { A: { x: 100, y: 100 }, B: { x: 120, y: 100 }, C: { x: 140, y: 100 }, D: { x: 160, y: 100 }, E: { x: 180, y: 100 } };
const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const key = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, "A"])) as Record<number, "A">;
function response(qrRaw = makeCardQr(examId, studentId)) {
  return { version: 1, status: "SUCCESS", cards: [{ layoutVersion: 2, qrRaw, geometry: { width: 1786, height: 1263 }, questions: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, marked: i === 0 ? ["A"] : i === 1 ? ["B"] : i === 2 ? ["A", "C"] : i === 3 ? [] : [], status: i === 2 ? "MULTIPLE" : i < 2 ? "MARKED" : i === 4 ? "UNCERTAIN" : "BLANK", scores, fillRatios: scores, centers, needsReview: i === 4, confidence: 1 })), quality: { markerError: 0, markerSpan: 1000, scale: 3 }, previewJpegBase64: "abcd" }] };
}
async function withResponse(payload: unknown, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (_input, init) => {
    assert.equal((init?.headers as Record<string,string>)["X-OMR-Questions"], "10");
    assert.match((init?.headers as Record<string,string>)["X-OMR-Signature"], /^[a-f0-9]{64}$/);
    return Response.json(payload);
  }) as typeof fetch;
  try { await run(); } finally { globalThis.fetch = original; }
}

test("Next grades raw marks, keeps review and draws exact overlay states", async () => {
  await withResponse(response(), async () => {
    const [card] = await recognizeCards(image, key, 10, examId);
    assert.deepEqual([card.summary.correct, card.summary.incorrect, card.summary.multiple, card.summary.review], [1, 1, 1, 1]);
    assert.deepEqual(overlayMarks(card.readings.slice(0, 5)).map(mark => `${mark.question}-${mark.answer}-${mark.color}`), ["1-A-orange", "2-B-orange", "2-A-green", "3-A-red", "3-C-red", "4-A-green"]);
  });
});

test("Next rejects QR from another exam and invalid signature", async () => {
  await withResponse(response(makeCardQr("08e6f6dd-197d-4ceb-bf67-399bfaadc102", studentId)), async () => {
    await assert.rejects(() => recognizeCards(image,key,10,examId), (error: unknown) => error instanceof OmrFailure && error.code === "WRONG_EXAM");
  });
  await withResponse(response("CLA2|2|bad"), async () => {
    await assert.rejects(() => recognizeCards(image,key,10,examId), (error: unknown) => error instanceof OmrFailure && error.code === "INVALID_QR");
  });
});

test("Next rejects inconsistent response contract", async () => {
  const invalid = response();
  invalid.cards[0].questions[0].marked = [answers[1]];
  invalid.cards[0].questions[0].number = 2;
  await withResponse(invalid, async () => {
    await assert.rejects(() => recognizeCards(image,key,10,examId), (error: unknown) => error instanceof OmrFailure && error.code === "OMR_BAD_RESPONSE");
  });
});

test("Next explains a non-JSON OMR endpoint response", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response("<html>Not found</html>", { status: 404, headers: { "content-type": "text/html" } })) as typeof fetch;
  try {
    await assert.rejects(() => recognizeCards(image, key, 10, examId), (error: unknown) => error instanceof OmrFailure && error.code === "OMR_BAD_RESPONSE" && error.message.includes("OMR_SERVICE_URL"));
  } finally { globalThis.fetch = original; }
});
