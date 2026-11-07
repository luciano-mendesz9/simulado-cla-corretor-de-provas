import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { ApiFailure } from "../src/lib/auth/server";
import { answerKeyHash, assertStudentMembership, officialKey, recalculate, reviewInput } from "../src/lib/corrections";
import { makeCardQr, parseCardQr } from "../src/lib/omr/card-qr";
import { GET as results } from "../src/app/api/exams/[id]/results/route";
import { GET as confirmedCard } from "../src/app/api/exams/[id]/results/[correctionId]/route";
import { POST as batches } from "../src/app/api/corrections/batches/route";
import { POST as analyze } from "../src/app/api/corrections/analyze/route";
import { boundedFormData } from "../src/lib/omr/upload";
import { POST as confirm } from "../src/app/api/corrections/confirm/route";
import type { QuestionReading } from "../src/lib/omr/bubble-reader";
import { bubblePaint, type ConfirmedAnswer } from "../src/lib/confirmed-card";

process.env.JWT_ACCESS_SECRET = "test-access-secret-0123456789-0123456789";
const examId = "08e6f6dd-197d-4ceb-bf67-399bfaadc101";
const studentId = "6307fb91-f892-4c08-a000-9c529f319101";

test("signed QR binds layout, exam and student", () => {
  const qr = makeCardQr(examId, studentId);
  assert.deepEqual(parseCardQr(qr), { layoutVersion: 2, examId, studentId });
  assert.equal(parseCardQr(qr.replace(studentId, "6307fb91-f892-4c08-a000-9c529f319102")), null);
  assert.equal(parseCardQr(`CLA1|${examId}|${studentId}`), null);
});
test("final grades are recalculated from a complete official key", () => {
  const exam = { questions: 4, answerKey: { 1: "A", 2: "B", 3: "C", 4: "D" } };
  const key = officialKey(exam as never);
  assert.equal(answerKeyHash(exam as never).length, 64);
  const readings = [
    { question: 1, selected: ["A"], status: "CORRETA" },
    { question: 2, selected: ["C"], status: "CORRETA" },
    { question: 3, selected: [], status: "EM_BRANCO" },
    { question: 4, selected: ["A", "D"], status: "MULTIPLA_MARCACAO" },
  ] as unknown as QuestionReading[];
  const result = recalculate(readings, key);
  assert.deepEqual([result.summary.correct, result.summary.incorrect, result.summary.blank, result.summary.multiple, result.summary.percentage], [1, 1, 1, 1, 25]);
  assert.equal(result.readings[1].status, "INCORRETA");
  assert.throws(() => officialKey({ questions: 4, answerKey: { 1: "A" } } as never), (error: unknown) => error instanceof ApiFailure && error.status === 409);
  assert.equal(reviewInput.safeParse({ revision: 0, question: 1, selected: ["A", "C"] }).success, true);
  assert.equal(reviewInput.safeParse({ revision: 0, score: 100 }).success, false);
});
test("recognized students must be unique and enrolled in the exam classroom", () => {
  assert.doesNotThrow(() => assertStudentMembership([studentId], [studentId]));
  assert.throws(() => assertStudentMembership([studentId], []), (error: unknown) => error instanceof ApiFailure && error.status === 422);
  assert.throws(() => assertStudentMembership([studentId, studentId], [studentId]), (error: unknown) => error instanceof ApiFailure && error.status === 422);
});
test("confirmed card colors use persisted correct and selected answers", () => {
  const answers: ConfirmedAnswer[] = [
    { question: 1, correct: "A", selected: ["A"], status: "CORRETA" },
    { question: 2, correct: "B", selected: ["C"], status: "INCORRETA" },
    { question: 3, correct: "C", selected: [], status: "EM_BRANCO" },
    { question: 4, correct: "D", selected: ["D", "E"], status: "MULTIPLA_MARCACAO" },
  ];
  assert.deepEqual([
    bubblePaint("A", answers[0]), bubblePaint("B", answers[0]),
    bubblePaint("B", answers[1]), bubblePaint("C", answers[1]),
    bubblePaint("C", answers[2]),
    bubblePaint("D", answers[3]), bubblePaint("E", answers[3]),
  ], ["correct-selected", "empty", "correct-missed", "wrong-selected", "correct-missed", "correct-selected", "wrong-selected"]);
});
test("correction APIs require authentication and reject foreign origins before database access", async () => {
  assert.equal((await results(new NextRequest(`http://localhost:3000/api/exams/${examId}/results`), { params: Promise.resolve({ id: examId }) } as RouteContext<"/api/exams/[id]/results">)).status, 401);
  assert.equal((await confirmedCard(new NextRequest(`http://localhost:3000/api/exams/${examId}/results/${studentId}`), { params: Promise.resolve({ id: examId, correctionId: studentId }) } as RouteContext<"/api/exams/[id]/results/[correctionId]">)).status, 401);
  assert.equal((await batches(new NextRequest("http://localhost:3000/api/corrections/batches", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ examId, maxCards: 1 }) }))).status, 401);
  assert.equal((await analyze(new NextRequest("http://localhost:3000/api/corrections/analyze", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "multipart/form-data" } }))).status, 401);
  assert.equal((await confirm(new NextRequest("http://localhost:3000/api/corrections/confirm", { method: "POST", headers: { origin: "https://other.example", "content-type": "application/json" }, body: JSON.stringify({ draftIds: [studentId] }) }))).status, 403);
});
test("multipart parser bounds the body even without a content-length header", async () => {
  const form = new FormData(); form.set("batchId", examId); form.set("image", new File(["sample"], "sample.jpg", { type: "image/jpeg" }));
  const request = new NextRequest("http://localhost:3000/api/corrections/analyze", { method: "POST", body: form });
  const parsed = await boundedFormData(request);
  assert.equal(parsed.get("batchId"), examId);
  const oversized = new NextRequest("http://localhost:3000/api/corrections/analyze", { method: "POST", body: new Uint8Array(4_200_001) });
  await assert.rejects(() => boundedFormData(oversized), (error: unknown) => error instanceof ApiFailure && error.status === 413);
});
