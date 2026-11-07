import { Suspense } from "react";
import { z } from "zod";
import { PrintCardsPage } from "@/components/print-cards-page";
import { requirePage } from "@/lib/auth/server";
import { getPrisma } from "@/lib/prisma";
import { examDto } from "@/lib/exams";

export default function Page({ params }: PageProps<"/cartoes/[simuladoId]">) {
  return <Suspense fallback={<p className="route-loading">Preparando cartões…</p>}><Content params={params} /></Suspense>;
}

async function Content({ params }: { params: PageProps<"/cartoes/[simuladoId]">["params"] }) {
  const user = await requirePage(["PROFESSOR", "COORDENACAO"]);
  const { simuladoId } = await params;
  if (!z.uuid().safeParse(simuladoId).success) return <PrintCardsPage exam={null} students={[]} roomName="" role={user.role === "PROFESSOR" ? "professor" : "coordenacao"} />;
  const exam = await getPrisma().exam.findUnique({ where: { id: simuladoId }, include: { classroom: { include: { students: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] } } } } });
  return <PrintCardsPage exam={exam ? examDto(exam) : null} students={exam ? exam.classroom.students.map(student => ({ id: student.id, firstName: student.firstName, lastName: student.lastName, classId: student.classroomId })) : []} roomName={exam?.classroom.name || ""} role={user.role === "PROFESSOR" ? "professor" : "coordenacao"} />;
}
