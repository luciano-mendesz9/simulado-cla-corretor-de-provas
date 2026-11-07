"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";
import type { Exam, Role, Student } from "@/lib/model";

export function PrintCardsPage({ exam, students, roomName, role }: { exam: Exam | null; students: Student[]; roomName: string; role: Role }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const examId = exam?.id;
  const rosterKey = students.map(student => `${student.id}:${student.firstName}:${student.lastName}`).join("|");
  const back = exam ? `${role === "professor" ? "/professor" : "/coordenacao"}/simulados/${exam.id}` : role === "professor" ? "/professor" : "/coordenacao/simulados";

  useEffect(() => {
    if (!examId || !students.length) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    async function loadOfficialPdf() {
      setLoading(true);
      setError("");
      setPdfUrl(null);
      try {
        const response = await apiFetch(`/api/exams/${examId}/cards.pdf`, { signal: controller.signal });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Não foi possível gerar o PDF oficial.");
        }
        const generatedUrl = URL.createObjectURL(await response.blob());
        if (controller.signal.aborted) { URL.revokeObjectURL(generatedUrl); return; }
        objectUrl = generatedUrl;
        setPdfUrl(generatedUrl);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível gerar o PDF oficial.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadOfficialPdf();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [examId, rosterKey, roomName, students.length]);

  if (!exam) return <main className="print-loading"><p>Simulado não encontrado.</p><Link href={back}>Voltar aos simulados</Link></main>;

  function download() {
    if (!pdfUrl || !examId) return;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `cartoes-resposta-${examId}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
  }

  const pages = Math.ceil(students.length / 2);
  return <main className="print-screen">
    <div className="print-toolbar">
      <div><strong>Cartões-resposta · {exam.name}</strong><span>{roomName} · {students.length} alunos · {pages} página{pages === 1 ? "" : "s"} A4 · 2 cartões por página</span></div>
      <div><Link className="button secondary" href={back}>← Voltar</Link><button className="button primary" disabled={!pdfUrl || loading} onClick={download}>{loading ? "Gerando PDF…" : "Baixar PDF"}</button></div>
    </div>
    <div className="print-instructions">A visualização abaixo mostra o próprio PDF oficial usado pelo leitor óptico. Baixe esse PDF para imprimir em A4, sem ajustar a escala.</div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {!students.length ? <div className="print-empty">Esta turma ainda não possui alunos cadastrados.</div> : loading ? <div className="print-empty">Gerando a visualização do PDF oficial…</div> : pdfUrl ? <iframe className="official-pdf-preview" src={pdfUrl} title="PDF oficial dos cartões-resposta" /> : null}
  </main>;
}
