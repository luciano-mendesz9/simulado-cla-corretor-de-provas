import { NextRequest } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { classroomInput } from "@/lib/auth/validators";
import { authorize, safeError } from "@/lib/auth/server";
import { mutation, noStore, parseBody } from "@/lib/api";
export async function GET(request: NextRequest) {
  try {
    await authorize(request, ["COORDENACAO"]);
    const classrooms = await getPrisma().classroom.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { students: true } } } });
    return Response.json({ classrooms: classrooms.map(({ _count, ...room }) => ({ ...room, studentCount: _count.students })) }, { headers: noStore });
  } catch (error) { return safeError(error); }
}
export async function POST(request: NextRequest) {
  return mutation(request, async () => {
    await authorize(request, ["COORDENACAO"]);
    const body = await parseBody(request, classroomInput);
    const room = await getPrisma().classroom.create({ data: body });
    return Response.json({ classroom: room }, { status: 201, headers: noStore });
  });
}
