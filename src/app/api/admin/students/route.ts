import { NextRequest } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { studentInput } from "@/lib/auth/validators";
import { ApiFailure, authorize, safeError } from "@/lib/auth/server";
import { mutation, noStore, parseBody } from "@/lib/api";
export async function GET(request: NextRequest) {
  try {
    await authorize(request, ["COORDENACAO"]);
    const classroomId = request.nextUrl.searchParams.get("classroomId");
    if (classroomId && !z.uuid().safeParse(classroomId).success) throw new ApiFailure(400, "ID de turma inválido.");
    const students = await getPrisma().student.findMany({ where: classroomId ? { classroomId } : undefined, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
    return Response.json({ students }, { headers: noStore });
  } catch (error) { return safeError(error); }
}
export async function POST(request: NextRequest) {
  return mutation(request, async () => {
    await authorize(request, ["COORDENACAO"]);
    const body = await parseBody(request, studentInput);
    if (!await getPrisma().classroom.findUnique({ where: { id: body.classroomId }, select: { id: true } })) throw new ApiFailure(404, "Turma não encontrada.");
    const student = await getPrisma().student.create({ data: body });
    return Response.json({ student }, { status: 201, headers: noStore });
  });
}
