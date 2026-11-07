"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell, EmptyState, StatusBadge } from "@/components/ui";
import { CorrectionWorkspace } from "@/components/corrections/correction-workspace";
import { CorrectionResults } from "@/components/corrections/correction-results";
import { useData } from "@/components/data-provider";
import { dateLabel, examStatus, Role } from "@/lib/model";

export function ExamDetail({ examId, role }: { examId: string; role: Role }) {
  const { db, today, loaded, examError } = useData();
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [resultsRefresh, setResultsRefresh] = useState(0);
  const exam = db.exams.find(item => item.id === examId);
  const base = role === "coordenacao" ? "/coordenacao/simulados" : "/professor";
  if (!loaded) return <AppShell role={role} title="Carregando simulado"><p className="route-loading">Carregando simulado…</p></AppShell>;
  if (!exam) return <AppShell role={role} title="Simulado não encontrado"><Link className="back-link" href={base}>← Voltar</Link><EmptyState title={examError ? "Não foi possível carregar os simulados" : "Simulado não encontrado"} text={examError || "A avaliação pode ter sido removida."} /></AppShell>;
  const status = examStatus(exam, today);
  const keyComplete = Object.keys(exam.answerKey).length === exam.questions;
  const supported = exam.questions <= 40;
  const canCorrect = status === "Aberto para correção" && keyComplete && supported;
  return <AppShell role={role} title={exam.name} eyebrow="DETALHES DO SIMULADO" subtitle={`${exam.className || "Turma indisponível"} · ${exam.questions} questões`} actions={<StatusBadge status={status} />}>
    <Link className="back-link" href={base}>← Voltar para simulados</Link>
    <div className="detail-top-grid"><section className="panel detail-overview"><div className="panel-heading"><div><h2>Visão do simulado</h2><p>Dados da aplicação e da correção.</p></div><span className="panel-symbol">▤</span></div><div className="detail-facts"><div><span>Turma</span><strong>{exam.className || "—"}</strong></div><div><span>Questões</span><strong>{exam.questions}</strong></div><div><span>Aplicação</span><strong>{dateLabel(exam.applicationDate)}</strong></div><div><span>Correção aberta em</span><strong>{dateLabel(exam.correctionOpensAt)}</strong></div><div><span>Correção até</span><strong>{dateLabel(exam.correctionClosesAt)}</strong></div><div><span>Gabarito oficial</span><strong>{Object.keys(exam.answerKey).length}/{exam.questions} respostas</strong></div></div></section>
      <section className="panel detail-actions"><h2>Próximas ações</h2><p>Gere os cartões-resposta dos alunos atualmente cadastrados na turma.</p>{supported ? <Link className="button primary full" href={`/cartoes/${exam.id}`}>▤ Gerar cartões em PDF</Link> : <p className="action-note">Simulados antigos com mais de 40 questões não usam o novo cartão óptico.</p>}<button className="button secondary full" disabled={!canCorrect} onClick={() => setCorrectionOpen(true)}>◎ Corrigir cartões-resposta</button>{!canCorrect && <p className="action-note">{!supported ? "A leitura óptica aceita até 40 questões." : !keyComplete ? "Complete o gabarito oficial antes de corrigir." : "A correção só pode ser confirmada no período configurado."}</p>}<div className="action-divider" /><span className="mini-label">PREPARAÇÃO</span><ol className="flow-list"><li>Baixe os cartões em PDF</li><li>Imprima e distribua aos alunos</li><li>Recolha os cartões preenchidos</li><li>Analise, confira e confirme cada correção</li></ol></section></div>
    {correctionOpen && <CorrectionWorkspace exam={exam} onClose={() => setCorrectionOpen(false)} onResultsChange={() => setResultsRefresh(value => value + 1)} />}
    <CorrectionResults examId={exam.id} refresh={resultsRefresh} />
  </AppShell>;
}
