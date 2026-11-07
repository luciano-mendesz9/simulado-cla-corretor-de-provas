import { NextRequest } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { ApiFailure, authorize } from "@/lib/auth/server";
import { mutation, noStore, parseBody } from "@/lib/api";
import { assertCorrectionWindow, batchInput, officialKey } from "@/lib/corrections";

export async function POST(request: NextRequest) {
  return mutation(request, async () => {
    const user = await authorize(request);
    const body = await parseBody(request, batchInput);
    const db = getPrisma();
    await db.correctionBatch.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const exam = await db.exam.findUnique({ where: { id: body.examId } });
    if (!exam) throw new ApiFailure(404, "Simulado não encontrado.");
    assertCorrectionWindow(exam);
    officialKey(exam);
    const batch = await db.correctionBatch.create({ data: { examId: exam.id, createdById: user.id, maxCards: body.maxCards, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) } });
    return Response.json({ batch: { id: batch.id, examId: batch.examId, maxCards: batch.maxCards, expiresAt: batch.expiresAt } }, { status: 201, headers: noStore });
  });
}
