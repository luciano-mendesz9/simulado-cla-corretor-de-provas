import { writeFile } from "node:fs/promises";
import { makeCardsPdf } from "../src/lib/cards-pdf";
import type { Exam } from "../src/lib/model";

// Test-only identities. Never use this secret for a real card.
process.env.JWT_ACCESS_SECRET = "test-access-secret-0123456789-0123456789";
const questions = Number(process.argv[3] || 40);
const count = Number(process.argv[4] || 2);
const fixtureExamId = process.argv[5] || "08e6f6dd-197d-4ceb-bf67-399bfaadc101";
if (!Number.isInteger(questions) || questions < 1 || questions > 40 || !Number.isInteger(count) || count < 1 || count > 30) throw new Error("Use 1-40 questões e 1-30 alunos.");
const exam: Exam = {
  id: fixtureExamId, name: "Simulado OMR de teste", classId: "e4fa1b02-2c11-42c3-8f95-4a17e2b0c101",
  questions, applicationDate: "2026-11-07", correctionOpensAt: "2026-11-07", correctionClosesAt: "2026-11-20",
  answerKey: Object.fromEntries(Array.from({ length: questions }, (_, i) => [i+1, "A"])) as Exam["answerKey"],
};
const students = Array.from({ length: count }, (_, i) => ({ id: `6307fb91-f892-4c08-a000-9c529f3191${String(i+1).padStart(2,"0")}`, firstName: `Aluno ${i+1}`, lastName: "Teste" }));
async function main() {
  await writeFile(process.argv[2] || "/tmp/cla-omr-fixture.pdf", await makeCardsPdf(exam, "Turma de teste", students));
}
void main();
