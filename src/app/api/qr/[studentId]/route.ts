import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, authorize, safeError } from "@/lib/auth/server";
import { getPrisma } from "@/lib/prisma";
import * as QRCode from "@/lib/vendor/qrcode/core/qrcode";
import * as SvgRenderer from "@/lib/vendor/qrcode/renderer/svg-tag";
import { makeCardQr } from "@/lib/omr/card-qr";

export async function GET(request: NextRequest, context: RouteContext<"/api/qr/[studentId]">) {
  try {
    await authorize(request);
    const { studentId } = await context.params;
    const examId = request.nextUrl.searchParams.get("examId");
    if (!z.uuid().safeParse(studentId).success || !z.uuid().safeParse(examId).success) throw new ApiFailure(400, "IDs inválidos.");
    const exam = await getPrisma().exam.findUnique({ where: { id: examId! }, select: { classroomId: true } });
    if (!exam || !await getPrisma().student.findFirst({ where: { id: studentId, classroomId: exam.classroomId }, select: { id: true } })) throw new ApiFailure(404, "Cartão não encontrado.");
    const qr = QRCode.create(makeCardQr(examId!, studentId), { errorCorrectionLevel: "M" } as Parameters<typeof QRCode.create>[1]);
    const svg = SvgRenderer.render(qr, { margin: 4, width: 120 });
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return safeError(error); }
}
