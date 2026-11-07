import { NextRequest } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { classroomInput } from "@/lib/auth/validators";
import { ApiFailure, authorize } from "@/lib/auth/server";
import { mutation, noStore, parseBody } from "@/lib/api";
type Context = RouteContext<"/api/admin/classrooms/[id]">;
async function idFrom(context: Context) { const id = (await context.params).id; if (!z.uuid().safeParse(id).success) throw new ApiFailure(400, "ID inválido."); return id; }
export async function PATCH(request: NextRequest, context: Context) {
  return mutation(request, async () => {
    await authorize(request, ["COORDENACAO"]);
    const id = await idFrom(context);
    const body = await parseBody(request, classroomInput);
    const room = await getPrisma().classroom.update({ where: { id }, data: body });
    return Response.json({ classroom: room }, { headers: noStore });
  });
}
export async function DELETE(request: NextRequest, context: Context) {
  return mutation(request, async () => {
    await authorize(request, ["COORDENACAO"]);
    const id = await idFrom(context);
    const [students, exams] = await Promise.all([
      getPrisma().student.count({ where: { classroomId: id } }),
      getPrisma().exam.count({ where: { classroomId: id } }),
    ]);
    if (students || exams) throw new ApiFailure(409, "Esta turma possui alunos ou simulados vinculados. Remova esses vínculos antes de excluí-la.");
    await getPrisma().classroom.delete({ where: { id } });
    return Response.json({ ok: true }, { headers: noStore });
  });
}
