import { NextRequest } from "next/server";
import { Prisma, type CorrectionDraft } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { ApiFailure, authorize, safeError, assertSameOrigin } from "@/lib/auth/server";
import { noStore } from "@/lib/api";
import { answerKeyHash, assertCorrectionWindow, assertStudentMembership, officialKey, uuid, validateReadings } from "@/lib/corrections";
import { OmrFailure, recognizeCards } from "@/lib/omr";
import { summarize } from "@/lib/omr/bubble-reader";
import { boundedFormData } from "@/lib/omr/upload";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await authorize(request);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new ApiFailure(415, "Envie uma imagem em formulário.");
    if (Number(request.headers.get("content-length") || 0) > 4_200_000) throw new ApiFailure(413, "A requisição excede o limite de 4,2 MB.");
    const form = await boundedFormData(request);
    const batchId = form.get("batchId"), file = form.get("image");
    if (typeof batchId !== "string" || !uuid.safeParse(batchId).success || !(file instanceof File)) throw new ApiFailure(400, "Informe lote e imagem válidos.");
    if (file.size > 3_700_000) throw new ApiFailure(413, "Imagem acima de 3,7 MB.");
    if (!file.size) throw new ApiFailure(400, "Imagem vazia.");
    const db = getPrisma();
    const batch = await db.correctionBatch.findUnique({ where: { id: batchId }, include: { exam: { include: { classroom: true } } } });
    if (!batch || batch.createdById !== user.id) throw new ApiFailure(404, "Lote não encontrado.");
    if (batch.expiresAt <= new Date()) throw new ApiFailure(410, "O lote expirou. Inicie uma nova análise.");
    assertCorrectionWindow(batch.exam);
    const admitted = await db.correctionBatch.updateMany({ where: { id: batchId, analysisRequests: { lt: 60 } }, data: { analysisRequests: { increment: 1 } } });
    if (!admitted.count) throw new ApiFailure(429, "Este lote atingiu o limite de 60 tentativas de análise.");
    const key = officialKey(batch.exam), keyHash = answerKeyHash(batch.exam);
    let cards;
    try { cards = await recognizeCards(Buffer.from(await file.arrayBuffer()), key, batch.exam.questions, batch.examId); }
    catch (error) { if (error instanceof OmrFailure) throw new ApiFailure(error.httpStatus, `${error.code}: ${error.message}`); throw error; }
    const studentIds = cards.map(card => card.studentId);
    const students = await db.student.findMany({ where: { id: { in: studentIds }, classroomId: batch.exam.classroomId }, select: { id: true, firstName: true, lastName: true } });
    assertStudentMembership(studentIds, students.map(student => student.id));
    const existing = await db.correction.findMany({ where: { examId: batch.examId, studentId: { in: studentIds } }, select: { studentId: true } });
    if (existing.length) throw new ApiFailure(409, "Já existe uma correção confirmada para um aluno deste arquivo.");
    let drafts;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        drafts = await db.$transaction(async tx => {
          const prior = await tx.correctionDraft.findMany({ where: { batchId, studentId: { in: studentIds } } });
          for (const card of cards) {
            const previous = prior.find(item => item.studentId === card.studentId);
            if (previous && previous.imageHash !== card.imageHash) throw new ApiFailure(409, "Este aluno já tem um cartão analisado no lote. Inicie outro lote para usar uma nova foto.");
          }
          const fresh = cards.filter(card => !prior.some(item => item.studentId === card.studentId));
          if (fresh.length) {
            const count = await tx.correctionDraft.count({ where: { batchId } });
            if (count + fresh.length > batch.maxCards) throw new ApiFailure(409, "O lote atingiu o limite de cartões informado.");
          }
          const created: CorrectionDraft[] = [];
          for (const card of fresh) created.push(await tx.correctionDraft.create({ data: { batchId, examId: batch.examId, studentId: card.studentId, imageHash: card.imageHash, answerKeyHash: keyHash, layoutVersion: card.layoutVersion, readings: card.readings as unknown as Prisma.InputJsonValue, quality: card.quality as Prisma.InputJsonValue, manualChanges: [], expiresAt: batch.expiresAt } }));
          return cards.map(card => [...prior, ...created].find(item => item.studentId === card.studentId)!);
        }, { isolationLevel: "Serializable" });
        break;
      } catch (error) {
        if ((error as { code?: string }).code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    if (!drafts) throw new ApiFailure(409, "O lote sofreu concorrência. Tente novamente.");
    return Response.json({ cards: cards.map((card, i) => {
      const saved = drafts[i];
      const readings = validateReadings(saved.readings, batch.exam.questions);
      const student = students.find(s => s.id === card.studentId)!;
      return { draftId: saved.id, studentId: card.studentId, studentName: `${student.firstName} ${student.lastName}`, examId: batch.examId, examName: batch.exam.name, className: batch.exam.classroom.name, readings, summary: summarize(readings), revision: saved.revision, reviewedAt: saved.reviewedAt, previewDataUrl: card.previewDataUrl, previewWidth: card.previewWidth, previewHeight: card.previewHeight, quality: card.quality };
    }) }, { status: 201, headers: noStore });
  } catch (error) { return safeError(error); }
}
