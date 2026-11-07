import { NextRequest } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { ApiFailure, authorize, safeError } from "@/lib/auth/server";
import { uuid } from "@/lib/corrections";
import { noStore } from "@/lib/api";
import { summarize, type QuestionReading } from "@/lib/omr/bubble-reader";

export async function GET(request: NextRequest, context: RouteContext<"/api/corrections/batches/[id]">) {
  try {
    const user = await authorize(request);
    const { id } = await context.params;
    if (!uuid.safeParse(id).success) throw new ApiFailure(400, "ID inválido.");
    const batch = await getPrisma().correctionBatch.findUnique({ where: { id }, include: { drafts: { include: { student: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } }, exam: { select: { name: true, classroom: { select: { name: true } } } } } });
    if (!batch || batch.createdById !== user.id) throw new ApiFailure(404, "Lote não encontrado.");
    const confirmed = await getPrisma().correction.findMany({ where: { sourceDraftId: { in: batch.drafts.map(d => d.id) } }, select: { sourceDraftId: true } });
    const confirmedIds = new Set(confirmed.map(item => item.sourceDraftId));
    return Response.json({ batch: { id: batch.id, examId: batch.examId, examName: batch.exam.name, className: batch.exam.classroom.name, maxCards: batch.maxCards, expiresAt: batch.expiresAt }, drafts: batch.drafts.map(draft => ({ id: draft.id, studentId: draft.studentId, studentName: `${draft.student.firstName} ${draft.student.lastName}`, readings: draft.readings, summary: summarize(draft.readings as QuestionReading[]), revision: draft.revision, reviewedAt: draft.reviewedAt, confirmed: confirmedIds.has(draft.id), previewAvailable: false })) }, { headers: noStore });
  } catch (error) { return safeError(error); }
}
