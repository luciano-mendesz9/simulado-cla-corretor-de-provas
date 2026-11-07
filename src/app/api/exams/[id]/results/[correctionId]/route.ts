import { NextRequest } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { ApiFailure, authorize, safeError } from "@/lib/auth/server";
import { noStore } from "@/lib/api";
import { classify } from "@/lib/omr/bubble-reader";

const answer = z.enum(["A", "B", "C", "D", "E"]);
const savedAnswer = z.object({
  question: z.number().int().positive(),
  selected: z.array(answer).max(5),
  correct: answer,
  status: z.enum(["CORRETA", "INCORRETA", "EM_BRANCO", "MULTIPLA_MARCACAO"]),
});

export async function GET(request: NextRequest, context: RouteContext<"/api/exams/[id]/results/[correctionId]">) {
  try {
    await authorize(request);
    const { id, correctionId } = await context.params;
    if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(correctionId).success) throw new ApiFailure(400, "ID inválido.");
    const correction = await getPrisma().correction.findFirst({
      where: { id: correctionId, examId: id },
      include: { answers: { orderBy: { question: "asc" } }, exam: { select: { applicationDate: true } } },
    });
    if (!correction) throw new ApiFailure(404, "Correção confirmada não encontrada neste simulado.");
    if (correction.answers.length !== correction.total) throw new ApiFailure(409, "As respostas confirmadas estão incompletas.");
    const answers = correction.answers.map((row, index) => {
      const parsed = savedAnswer.safeParse({ question: row.question, selected: row.selected, correct: row.correct, status: row.status });
      if (!parsed.success || parsed.data.question !== index + 1 || new Set(parsed.data.selected).size !== parsed.data.selected.length || parsed.data.status !== classify(parsed.data.selected, parsed.data.correct)) {
        throw new ApiFailure(409, "As respostas confirmadas estão inconsistentes.");
      }
      return parsed.data;
    });
    return Response.json({
      id: correction.id,
      studentName: correction.studentName,
      className: correction.className,
      examName: correction.examName,
      applicationDate: correction.exam.applicationDate.toISOString().slice(0, 10),
      total: correction.total,
      correct: correction.correct,
      answers,
    }, { headers: noStore });
  } catch (error) { return safeError(error); }
}
