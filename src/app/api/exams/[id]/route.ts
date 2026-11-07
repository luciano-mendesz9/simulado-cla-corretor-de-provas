import { NextRequest } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { ApiFailure, authorize, safeError } from "@/lib/auth/server";
import { mutation, noStore, parseBody } from "@/lib/api";
import { examData, examDto, examInput } from "@/lib/exams";

type Context = RouteContext<"/api/exams/[id]">;
async function idFrom(context: Context) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) throw new ApiFailure(400, "ID inválido.");
  return id;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    await authorize(request);
    const id = await idFrom(context);
    const exam = await getPrisma().exam.findUnique({ where: { id }, include: { classroom: { select: { name: true } } } });
    if (!exam) throw new ApiFailure(404, "Simulado não encontrado.");
    return Response.json({ exam: { ...examDto(exam), className: exam.classroom.name } }, { headers: noStore });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: NextRequest, context: Context) {
  return mutation(request, async () => {
    await authorize(request, ["COORDENACAO"]);
    const id = await idFrom(context);
    const body = await parseBody(request, examInput);
    if (await getPrisma().correction.findFirst({ where: { examId: id }, select: { id: true } })) throw new ApiFailure(409, "Este simulado já possui notas confirmadas e não pode ser alterado sem uma revisão auditável.");
    if (!await getPrisma().classroom.findUnique({ where: { id: body.classId }, select: { id: true } })) throw new ApiFailure(400, "Turma não encontrada.");
    const exam = await getPrisma().exam.update({ where: { id }, data: examData(body) });
    return Response.json({ exam: examDto(exam) }, { headers: noStore });
  });
}

export async function DELETE(request: NextRequest, context: Context) {
  return mutation(request, async () => {
    await authorize(request, ["COORDENACAO"]);
    const id = await idFrom(context);
    if (await getPrisma().correction.findFirst({ where: { examId: id }, select: { id: true } })) throw new ApiFailure(409, "Este simulado possui notas confirmadas e não pode ser excluído.");
    await getPrisma().exam.delete({ where: { id } });
    return Response.json({ ok: true }, { headers: noStore });
  });
}
