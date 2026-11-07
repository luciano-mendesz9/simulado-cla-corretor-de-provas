import { Suspense } from "react";
import { StudentsPage } from "@/components/students-page";

export default function Page({ params }: PageProps<"/coordenacao/turmas/[turmaId]/alunos">) {
  return <Suspense fallback={<p className="route-loading">Carregando turma…</p>}><Content params={params} /></Suspense>;
}

async function Content({ params }: { params: PageProps<"/coordenacao/turmas/[turmaId]/alunos">["params"] }) {
  const { turmaId } = await params;
  return <StudentsPage turmaId={turmaId} />;
}
