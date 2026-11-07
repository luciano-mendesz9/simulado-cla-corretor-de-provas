import { Suspense } from "react";
import { ExamDetail } from "@/components/exam-detail";

export default function Page({ params }: PageProps<"/coordenacao/simulados/[simuladoId]">) {
  return <Suspense fallback={<p className="route-loading">Carregando simulado…</p>}><Content params={params} /></Suspense>;
}

async function Content({ params }: { params: PageProps<"/coordenacao/simulados/[simuladoId]">["params"] }) {
  const { simuladoId } = await params;
  return <ExamDetail examId={simuladoId} role="coordenacao" />;
}
