import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { ApiFailure, authorize } from "@/lib/auth/server";
import { mutation, noStore, parseBody } from "@/lib/api";
import { answerKeyHash, officialKey, reviewInput, uuid, validateReadings } from "@/lib/corrections";
import { classify, summarize, type Answer } from "@/lib/omr/bubble-reader";

export async function PATCH(request: NextRequest, context: RouteContext<"/api/corrections/drafts/[id]">) {
  return mutation(request, async () => {
    const user = await authorize(request);
    const { id } = await context.params;
    if (!uuid.safeParse(id).success) throw new ApiFailure(400, "ID inválido.");
    const body = await parseBody(request, reviewInput);
    const db = getPrisma();
    const draft = await db.correctionDraft.findUnique({ where: { id }, include: { batch: true, exam: true } });
    if (!draft || draft.batch.createdById !== user.id) throw new ApiFailure(404, "Rascunho não encontrado.");
    if (draft.expiresAt <= new Date()) throw new ApiFailure(410, "Rascunho expirado. Analise o cartão novamente.");
    if (draft.revision !== body.revision) throw new ApiFailure(409, "Este rascunho foi alterado. Atualize a lista antes de continuar.");
    if (await db.correction.findUnique({ where: { sourceDraftId: id }, select: { id: true } })) throw new ApiFailure(409, "Esta correção já foi confirmada.");
    const key = officialKey(draft.exam);
    if (draft.answerKeyHash !== answerKeyHash(draft.exam)) throw new ApiFailure(409, "O gabarito oficial mudou. Analise o cartão novamente.");
    const readings = validateReadings(draft.readings, draft.exam.questions);
    const changes = Array.isArray(draft.manualChanges) ? [...draft.manualChanges] : [];
    let reviewedAt = draft.reviewedAt, reviewedById = draft.reviewedById;
    if (body.question !== undefined && body.selected !== undefined) {
      if (new Set(body.selected).size !== body.selected.length) throw new ApiFailure(400, "Alternativas repetidas.");
      const before = readings[body.question - 1];
      if (!before) throw new ApiFailure(400, "Questão inexistente.");
      const selected = body.selected as Answer[];
      readings[body.question - 1] = { ...before, selected, correct: key[body.question], status: classify(selected, key[body.question]), manual: true };
      changes.push({ question: body.question, before: before.selected, after: selected, actorId: user.id, at: new Date().toISOString() });
      reviewedAt = null; reviewedById = null;
    }
    if (body.review) {
      if (readings.some(item => item.status === "REVISAO_NECESSARIA")) throw new ApiFailure(409, "Resolva as questões inconclusivas antes de concluir a revisão.");
      reviewedAt = new Date(); reviewedById = user.id;
    }
    const updated = await db.correctionDraft.updateMany({ where: { id, revision: body.revision }, data: { readings: readings as unknown as Prisma.InputJsonValue, manualChanges: changes as Prisma.InputJsonValue, revision: { increment: 1 }, reviewedAt, reviewedById } });
    if (!updated.count) throw new ApiFailure(409, "Este rascunho foi alterado por outra requisição.");
    return Response.json({ draft: { id, readings, summary: summarize(readings), revision: body.revision + 1, reviewedAt } }, { headers: noStore });
  });
}
