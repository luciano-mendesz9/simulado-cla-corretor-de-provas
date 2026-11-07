import { NextRequest } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { ApiFailure, authorize, safeError } from "@/lib/auth/server";
import { examDto } from "@/lib/exams";
import { makeCardsPdf } from "@/lib/cards-pdf";
import { CARD_LAYOUT } from "@/lib/omr/layout";

export async function GET(request: NextRequest, context: RouteContext<"/api/exams/[id]/cards.pdf">) {
  try {
    await authorize(request);
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new ApiFailure(400, "ID inválido.");
    const exam = await getPrisma().exam.findUnique({ where: { id }, include: { classroom: true } });
    if (!exam) throw new ApiFailure(404, "Simulado não encontrado.");
    if (exam.questions > CARD_LAYOUT.maxQuestions) throw new ApiFailure(409, "O novo cartão de leitura óptica aceita até 40 questões.");
    const students = await getPrisma().student.findMany({
      where: { classroomId: exam.classroomId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    });
    if (!students.length) throw new ApiFailure(409, "A turma deste simulado não possui alunos cadastrados.");
    const bytes = await makeCardsPdf(examDto(exam), exam.classroom.name, students);
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cartoes-resposta-${id}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return safeError(error); }
}
