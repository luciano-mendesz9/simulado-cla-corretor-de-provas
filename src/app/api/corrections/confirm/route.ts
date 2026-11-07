import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { ApiFailure, authorize } from "@/lib/auth/server";
import { mutation, noStore, parseBody } from "@/lib/api";
import { answerKeyHash, assertCorrectionWindow, confirmInput, officialKey, recalculate, validateReadings } from "@/lib/corrections";

async function confirmOne(draftId: string, userId: string, userName: string) {
  const db = getPrisma();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async tx => {
        const sameDraft = await tx.correction.findUnique({ where: { sourceDraftId: draftId }, select: { id: true, confirmedById: true } });
        if (sameDraft) {
          if (sameDraft.confirmedById !== userId) throw new ApiFailure(404, "Rascunho não encontrado.");
          return { draftId, correctionId: sameDraft.id, idempotent: true };
        }
        const draft = await tx.correctionDraft.findUnique({ where: { id: draftId }, include: { batch: true, exam: { include: { classroom: true } }, student: true } });
        if (!draft || draft.batch.createdById !== userId) throw new ApiFailure(404, "Rascunho não encontrado.");
        if (draft.expiresAt <= new Date()) throw new ApiFailure(410, "Rascunho expirado.");
        if (!draft.reviewedAt || !draft.reviewedById) throw new ApiFailure(409, "Confira e marque o cartão como revisado antes de confirmar.");
        assertCorrectionWindow(draft.exam);
        if (draft.student.classroomId !== draft.exam.classroomId || draft.examId !== draft.batch.examId) throw new ApiFailure(409, "Aluno, turma e simulado não correspondem mais.");
        if (draft.answerKeyHash !== answerKeyHash(draft.exam)) throw new ApiFailure(409, "O gabarito oficial mudou. Analise novamente.");
        const existing = await tx.correction.findUnique({ where: { examId_studentId: { examId: draft.examId, studentId: draft.studentId } }, select: { id: true } });
        if (existing) throw new ApiFailure(409, "Este aluno já possui correção confirmada neste simulado.");
        const { readings, summary } = recalculate(validateReadings(draft.readings, draft.exam.questions), officialKey(draft.exam));
        if (summary.review) throw new ApiFailure(409, "Há questões inconclusivas.");
        const manualChanges = Array.isArray(draft.manualChanges) ? draft.manualChanges : [];
        const manualEvents = manualChanges.flatMap(change => {
          if (!change || typeof change !== "object" || Array.isArray(change)) return [];
          return [{ actorId: typeof change.actorId === "string" ? change.actorId : userId, action: "MANUAL_REVIEW", details: change as Prisma.InputJsonValue }];
        });
        const correction = await tx.correction.create({ data: {
          examId: draft.examId, studentId: draft.studentId, sourceDraftId: draftId, answerKeyHash: draft.answerKeyHash,
          studentName: `${draft.student.firstName} ${draft.student.lastName}`, className: draft.exam.classroom.name, examName: draft.exam.name, confirmedByName: userName,
          total: summary.total, correct: summary.correct, incorrect: summary.incorrect, blank: summary.blank, multiple: summary.multiple, percentage: summary.percentage, confirmedById: userId,
          answers: { create: readings.map(item => ({ question: item.question, selected: item.selected, correct: item.correct, status: item.status, score: item.status === "CORRETA" ? 1 : 0, manual: item.manual })) },
          events: { create: [
            ...manualEvents,
            { actorId: userId, action: "CONFIRMED", details: { sourceDraftId: draftId, answerKeyHash: draft.answerKeyHash, reviewedById: draft.reviewedById } },
          ] },
        } });
        return { draftId, correctionId: correction.id, idempotent: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if ((error as { code?: string }).code === "P2034" && attempt < 2) continue;
      if ((error as { code?: string }).code === "P2002") {
        const same = await db.correction.findUnique({ where: { sourceDraftId: draftId }, select: { id: true, confirmedById: true } });
        if (same && same.confirmedById === userId) return { draftId, correctionId: same.id, idempotent: true };
        throw new ApiFailure(409, "Este aluno já possui correção confirmada neste simulado.");
      }
      throw error;
    }
  }
  throw new ApiFailure(409, "A confirmação sofreu concorrência. Tente novamente.");
}

export async function POST(request: NextRequest) {
  return mutation(request, async () => {
    const user = await authorize(request);
    const { draftIds } = await parseBody(request, confirmInput);
    if (new Set(draftIds).size !== draftIds.length) throw new ApiFailure(400, "Rascunhos repetidos na solicitação.");
    const results = [];
    for (const draftId of draftIds) {
      try { results.push({ ...(await confirmOne(draftId, user.id, `${user.firstName} ${user.lastName}`)), ok: true }); }
      catch (error) { results.push({ draftId, ok: false, error: error instanceof ApiFailure ? error.message : "Não foi possível confirmar esta correção." }); }
    }
    return Response.json({ results }, { headers: noStore });
  });
}
