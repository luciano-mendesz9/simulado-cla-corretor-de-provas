import { z } from "zod";
import type { Exam as PrismaExam } from "@/generated/prisma/client";
import type { Answer, Exam } from "@/lib/model";

const date = z.iso.date();
const answer = z.enum(["A", "B", "C", "D", "E"]);
const fields = z.strictObject({
  name: z.string().trim().min(1, "Informe o nome do simulado.").max(120),
  classId: z.uuid(),
  questions: z.number().int().min(1).max(40),
  applicationDate: date,
  correctionOpensAt: date,
  correctionClosesAt: date,
  answerKey: z.record(z.string(), answer),
});

export const examInput = fields.superRefine((value, context) => {
  if (value.applicationDate > value.correctionOpensAt || value.correctionOpensAt > value.correctionClosesAt) {
    context.addIssue({ code: "custom", message: "Confira a ordem das datas de aplicação e correção." });
  }
  for (const key of Object.keys(value.answerKey)) {
    const number = Number(key);
    if (!Number.isInteger(number) || number < 1 || number > value.questions || String(number) !== key) {
      context.addIssue({ code: "custom", message: "O gabarito contém uma questão inválida.", path: ["answerKey", key] });
    }
  }
});

export type ExamInput = z.output<typeof examInput>;
export function examData(value: ExamInput) {
  return {
    name: value.name,
    classroomId: value.classId,
    questions: value.questions,
    applicationDate: new Date(`${value.applicationDate}T00:00:00.000Z`),
    correctionOpensAt: new Date(`${value.correctionOpensAt}T00:00:00.000Z`),
    correctionClosesAt: new Date(`${value.correctionClosesAt}T00:00:00.000Z`),
    answerKey: value.answerKey,
  };
}
export function examDto(value: PrismaExam): Exam {
  return {
    id: value.id,
    name: value.name,
    classId: value.classroomId,
    questions: value.questions,
    applicationDate: value.applicationDate.toISOString().slice(0, 10),
    correctionOpensAt: value.correctionOpensAt.toISOString().slice(0, 10),
    correctionClosesAt: value.correctionClosesAt.toISOString().slice(0, 10),
    answerKey: value.answerKey as Record<number, Answer>,
  };
}
