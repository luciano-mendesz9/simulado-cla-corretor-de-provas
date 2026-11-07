import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { examInput } from "../src/lib/exams";
import { makeCardsPdf } from "../src/lib/cards-pdf";
import { PDFDocument } from "../src/lib/vendor/pdf-lib.min.js";
import { examStatus } from "../src/lib/model";
import { GET as listExams, POST as createExam } from "../src/app/api/exams/route";
import { GET as downloadCards } from "../src/app/api/exams/[id]/cards.pdf/route";

const input = {
  name: "Simulado de Matemática", classId: "e4fa1b02-2c11-42c3-8f95-4a17e2b0c101", questions: 40,
  applicationDate: "2026-11-07", correctionOpensAt: "2026-11-07", correctionClosesAt: "2026-11-20", answerKey: { "1": "A" },
} as const;
process.env.JWT_ACCESS_SECRET = "test-access-secret-0123456789-0123456789";

test("exam input validates dates, question bounds and answer key", () => {
  assert.equal(examInput.safeParse(input).success, true);
  assert.equal(examInput.safeParse({ ...input, correctionClosesAt: "2026-11-06" }).success, false);
  assert.equal(examInput.safeParse({ ...input, questions: 41 }).success, false);
  assert.equal(examInput.safeParse({ ...input, answerKey: { "41": "B" } }).success, false);
  assert.equal(examInput.safeParse({ ...input, answerKey: { "1": "F" } }).success, false);
});

test("teacher status follows the exam dates", () => {
  const exam = { ...input, id: "08e6f6dd-197d-4ceb-bf67-399bfaadc101", answerKey: { 1: "A" as const } };
  assert.equal(examStatus(exam, "2026-11-06"), "Aguardando aplicação");
  assert.equal(examStatus({ ...exam, correctionOpensAt: "2026-11-08" }, "2026-11-07"), "Em aplicação");
  assert.equal(examStatus(exam, "2026-11-07"), "Aberto para correção");
  assert.equal(examStatus(exam, "2026-11-20"), "Aberto para correção");
  assert.equal(examStatus(exam, "2026-11-21"), "Fechado para correção");
});

test("exam and PDF endpoints reject anonymous requests before database access", async () => {
  assert.equal((await listExams(new NextRequest("http://localhost:3000/api/exams"))).status, 401);
  const context = { params: Promise.resolve({ id: "08e6f6dd-197d-4ceb-bf67-399bfaadc101" }) } as RouteContext<"/api/exams/[id]/cards.pdf">;
  assert.equal((await downloadCards(new NextRequest("http://localhost:3000/api/exams/08e6f6dd-197d-4ceb-bf67-399bfaadc101/cards.pdf"), context)).status, 401);
  const crossSite = new NextRequest("http://localhost:3000/api/exams", { method: "POST", headers: { origin: "https://other.example", "content-type": "application/json" }, body: JSON.stringify(input) });
  assert.equal((await createExam(crossSite)).status, 403);
});

test("PDF contains every student with two cards per A4 page", async () => {
  const exam = { ...input, id: "08e6f6dd-197d-4ceb-bf67-399bfaadc101", answerKey: { 1: "A" as const } };
  const students = [1, 2, 3].map(n => ({ id: `6307fb91-f892-4c08-a000-9c529f31910${n}`, firstName: `Aluno ${n}`, lastName: "Teste" }));
  const bytes = await makeCardsPdf(exam, "3º Ano A", students);
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), "%PDF-");
  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), 2);
  for (const page of parsed.getPages()) {
    const { width, height } = page.getSize();
    assert.ok(Math.abs(width - 595.28) < 0.1);
    assert.ok(Math.abs(height - 841.89) < 0.1);
  }
});
