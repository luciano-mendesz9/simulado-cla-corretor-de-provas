"use client";

import Link from "next/link";
import { AppShell, EmptyState, StatusBadge } from "@/components/ui";
import { useData } from "@/components/data-provider";
import { dateLabel, examStatus } from "@/lib/model";

export default function TeacherDashboard() {
  const { db, today, loaded, examError } = useData();
  const open = db.exams.filter(e => examStatus(e, today) === "Aberto para correção");
  return <AppShell role="professor" title="Simulados" eyebrow="PAINEL DO PROFESSOR" subtitle="Confira as datas, os resultados e os períodos de correção disponíveis.">
    {examError && <p className="inline-error" role="alert">{examError}</p>}
    <section className="teacher-hero"><div><span className="hero-kicker">SUA ÁREA DE TRABALHO</span><h2>Encontre o simulado certo para cada momento.</h2><p>Abra uma avaliação para ver os detalhes, acompanhar o ranking e preparar a correção dos cartões.</p></div><span className="teacher-hero-art" aria-hidden="true">▤</span></section>
    <div className="stats-grid teacher-stats"><div className="stat-card"><span className="stat-icon orange">▤</span><strong>{db.exams.length}</strong><span>Simulados</span></div><div className="stat-card"><span className="stat-icon green">◫</span><strong>{open.length}</strong><span>Período de correção aberto</span></div><div className="stat-card"><span className="stat-icon violet">♙</span><strong>{db.exams.filter(exam => examStatus(exam, today) === "Aguardando aplicação").length}</strong><span>Aguardando aplicação</span></div></div>
    <section className="panel"><div className="panel-heading"><div><h2>Lista de simulados</h2><p>Simulados cadastrados pela coordenação. A correção automática ainda não está disponível.</p></div></div>{!loaded ? <p className="route-loading">Carregando simulados…</p> : db.exams.length ? <div className="teacher-exam-grid">{[...db.exams].sort((a,b) => b.applicationDate.localeCompare(a.applicationDate)).map(exam => <article className="teacher-exam-card" key={exam.id}><div className="teacher-exam-top"><span className="teacher-exam-icon">▤</span><StatusBadge status={examStatus(exam, today)} /></div><h3>{exam.name}</h3><p>{exam.className || "Turma indisponível"} · {exam.questions} questões</p><div className="teacher-exam-meta"><span>Aplicação <strong>{dateLabel(exam.applicationDate)}</strong></span><span>Correção <strong>{dateLabel(exam.correctionOpensAt)} a {dateLabel(exam.correctionClosesAt)}</strong></span></div><Link className="button secondary full" href={`/professor/simulados/${exam.id}`}>Ver detalhes →</Link></article>)}</div> : <EmptyState title="Nenhum simulado disponível" />}</section>
  </AppShell>;
}
