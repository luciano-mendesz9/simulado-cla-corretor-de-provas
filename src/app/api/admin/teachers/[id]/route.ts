import { NextRequest } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { teacherUpdateInput } from "@/lib/auth/validators";
import { ApiFailure, authorize } from "@/lib/auth/server";
import { mutation, noStore, parseBody } from "@/lib/api";
import { publicUser } from "@/lib/auth/core";
type Context = RouteContext<"/api/admin/teachers/[id]">;
async function teacherId(context: Context) {
  const id = (await context.params).id;
  if (!z.uuid().safeParse(id).success) throw new ApiFailure(400, "ID inválido.");
  const user = await getPrisma().user.findFirst({ where: { id, role: "PROFESSOR" }, select: { id: true } });
  if (!user) throw new ApiFailure(404, "Professor não encontrado.");
  return id;
}
export async function PATCH(request: NextRequest, context: Context) {
  return mutation(request, async () => {
    await authorize(request, ["COORDENACAO"]);
    const id = await teacherId(context);
    const body = await parseBody(request, teacherUpdateInput);
    const user = await getPrisma().$transaction(async tx => {
      const updated = await tx.user.update({ where: { id }, data: body });
      if (body.status === "INATIVO") await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      return updated;
    });
    return Response.json({ teacher: publicUser(user) }, { headers: noStore });
  });
}
export async function DELETE(request: NextRequest, context: Context) {
  return mutation(request, async () => {
    await authorize(request, ["COORDENACAO"]);
    await getPrisma().user.delete({ where: { id: await teacherId(context) } });
    return Response.json({ ok: true }, { headers: noStore });
  });
}
