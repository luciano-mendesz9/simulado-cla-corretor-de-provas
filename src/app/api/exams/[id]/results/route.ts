import { NextRequest } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { ApiFailure, authorize, safeError } from "@/lib/auth/server";
import { noStore } from "@/lib/api";
import { uuid } from "@/lib/corrections";

export async function GET(request: NextRequest, context: RouteContext<"/api/exams/[id]/results">) {
  try {
    await authorize(request);
    const { id } = await context.params;
    if (!uuid.safeParse(id).success) throw new ApiFailure(400, "ID inválido.");
    const exam = await getPrisma().exam.findUnique({ where: { id }, select: { id: true, questions: true } });
    if (!exam) throw new ApiFailure(404, "Simulado não encontrado.");
    const items = await getPrisma().correction.findMany({ where: { examId: id }, orderBy: [{ correct: "desc" }, { confirmedAt: "asc" }] });
    const ordered = items.sort((a, b) => b.correct - a.correct || a.studentName.localeCompare(b.studentName, "pt-BR") || a.id.localeCompare(b.id));
    let position = 0, previous = -1;
    const ranking = ordered.map((item, index) => {
      if (item.correct !== previous) position = index + 1;
      previous = item.correct;
      return { position, id: item.id, studentId: item.studentId, studentName: item.studentName, correct: item.correct, incorrect: item.incorrect, blank: item.blank, multiple: item.multiple, total: item.total, percentage: item.percentage, confirmedAt: item.confirmedAt, confirmedBy: item.confirmedByName };
    });
    return Response.json({ total: ranking.length, ranking }, { headers: noStore });
  } catch (error) { return safeError(error); }
}
