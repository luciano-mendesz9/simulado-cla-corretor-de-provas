import { createHash } from "node:crypto";
import { z } from "zod";
import type { Exam } from "@/generated/prisma/client";
import { ApiFailure } from "@/lib/auth/server";
import { summarize, classify, type Answer, type QuestionReading } from "@/lib/omr/bubble-reader";
import { CARD_LAYOUT } from "@/lib/omr/layout";

export const uuid = z.uuid();
export const batchInput = z.strictObject({ examId: uuid, maxCards: z.number().int().min(1).max(60) });
export const reviewInput = z.strictObject({
  revision: z.number().int().min(0),
  review: z.literal(true).optional(),
  question: z.number().int().min(1).max(CARD_LAYOUT.maxQuestions).optional(),
  selected: z.array(z.enum(["A", "B", "C", "D", "E"])).max(5).optional(),
}).refine(value => value.review === true || (value.question !== undefined && value.selected !== undefined), "Informe uma revisão ou uma alteração explícita.");
export const confirmInput = z.strictObject({ draftIds: z.array(uuid).min(1).max(30) });

export function localToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function dateString(date: Date) { return date.toISOString().slice(0, 10); }
export function assertCorrectionWindow(exam: Pick<Exam, "correctionOpensAt" | "correctionClosesAt">) {
  const today = localToday();
  if (today < dateString(exam.correctionOpensAt) || today > dateString(exam.correctionClosesAt)) throw new ApiFailure(409, "O período de correção deste simulado está fechado.");
}
export function officialKey(exam: Pick<Exam, "questions" | "answerKey">): Record<number, Answer> {
  if (exam.questions < 1 || exam.questions > CARD_LAYOUT.maxQuestions) throw new ApiFailure(409, "A correção óptica aceita simulados de até 40 questões.");
  const raw = exam.answerKey as Record<string, unknown>;
  const key = {} as Record<number, Answer>;
  for (let n = 1; n <= exam.questions; n++) {
    const value = raw[String(n)];
    if (!value || !["A", "B", "C", "D", "E"].includes(String(value))) throw new ApiFailure(409, "Complete o gabarito oficial antes de analisar cartões.");
    key[n] = value as Answer;
  }
  return key;
}
export function answerKeyHash(exam: Pick<Exam, "questions" | "answerKey">) {
  const key = officialKey(exam);
  return createHash("sha256").update(`${exam.questions}|${Array.from({ length: exam.questions }, (_, i) => key[i + 1]).join("")}`).digest("hex");
}
export function assertStudentMembership(cardStudentIds: string[], enrolledStudentIds: string[]) {
  if (new Set(cardStudentIds).size !== cardStudentIds.length) throw new ApiFailure(422, "O mesmo aluno aparece duas vezes neste arquivo.");
  if (cardStudentIds.length !== enrolledStudentIds.length || cardStudentIds.some(id => !enrolledStudentIds.includes(id))) throw new ApiFailure(422, "Aluno não encontrado ou não pertencente à turma deste simulado.");
}
export function validateReadings(value: unknown, questions: number): QuestionReading[] {
  if (!Array.isArray(value) || value.length !== questions) throw new ApiFailure(409, "Rascunho de correção inválido.");
  return value.map((item, i) => {
    if (!item || typeof item !== "object" || item.question !== i + 1 || !Array.isArray(item.selected) || item.selected.some((a: unknown) => !["A", "B", "C", "D", "E"].includes(String(a))) || new Set(item.selected).size !== item.selected.length) throw new ApiFailure(409, "Rascunho de correção inválido.");
    return item as QuestionReading;
  });
}
export function recalculate(readings: QuestionReading[], key: Record<number, Answer>) {
  const updated = readings.map(item => ({ ...item, correct: key[item.question], status: classify(item.selected, key[item.question], item.status === "REVISAO_NECESSARIA" && !item.manual) }));
  return { readings: updated, summary: summarize(updated) };
}
