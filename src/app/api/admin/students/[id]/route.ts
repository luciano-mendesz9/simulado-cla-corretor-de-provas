import { NextRequest } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { studentInput } from "@/lib/auth/validators";
import { ApiFailure, authorize } from "@/lib/auth/server";
import { mutation, noStore, parseBody } from "@/lib/api";
type Context = RouteContext<"/api/admin/students/[id]">;
async function idFrom(context: Context) { const id = (await context.params).id; if (!z.uuid().safeParse(id).success) throw new ApiFailure(400, "ID inválido."); return id; }
export async function PATCH(request: NextRequest, context: Context) {
  return mutation(request, async () => {
    await authorize(request, ["COORDENACAO"]);
    const id = await idFrom(context);
    const body = await parseBody(request, studentInput);
    if (!await getPrisma().classroom.findUnique({ where: { id: body.classroomId }, select: { id: true } })) throw new ApiFailure(404, "Turma não encontrada.");
    const student = await getPrisma().student.update({ where: { id }, data: body });
    return Response.json({ student }, { headers: noStore });
  });
}
export async function DELETE(request: NextRequest, context: Context) {
  return mutation(request, async () => {
    await authorize(request, ["COORDENACAO"]);
    await getPrisma().student.delete({ where: { id: await idFrom(context) } });
    return Response.json({ ok: true }, { headers: noStore });
  });
}
