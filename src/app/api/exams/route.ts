import { NextRequest } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { ApiFailure, authorize, safeError } from "@/lib/auth/server";
import { mutation, noStore, parseBody } from "@/lib/api";
import { examData, examDto, examInput } from "@/lib/exams";

export async function GET(request: NextRequest) {
  try {
    await authorize(request);
    const exams = await getPrisma().exam.findMany({ orderBy: [{ applicationDate: "desc" }, { createdAt: "desc" }], include: { classroom: { select: { name: true } } } });
    return Response.json({ exams: exams.map(exam => ({ ...examDto(exam), className: exam.classroom.name })) }, { headers: noStore });
  } catch (error) { return safeError(error); }
}

export async function POST(request: NextRequest) {
  return mutation(request, async () => {
    await authorize(request, ["COORDENACAO"]);
    const body = await parseBody(request, examInput);
    if (!await getPrisma().classroom.findUnique({ where: { id: body.classId }, select: { id: true } })) throw new ApiFailure(400, "Turma não encontrada.");
    const exam = await getPrisma().exam.create({ data: examData(body) });
    return Response.json({ exam: examDto(exam) }, { status: 201, headers: noStore });
  });
}
