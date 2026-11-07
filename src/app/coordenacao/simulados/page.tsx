"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, ConfirmDialog, EmptyState, Modal, StatusBadge } from "@/components/ui";
import { useData } from "@/components/data-provider";
import { Answer, answers, dateLabel, Exam, examStatus, normalize } from "@/lib/model";
import { apiJson } from "@/lib/client-api";

const emptyExam = (): Exam => ({ id: "", name: "", classId: "", questions: 40, applicationDate: "", correctionOpensAt: "", correctionClosesAt: "", answerKey: {} });
export default function ExamsPage() {
  const { db, loaded, examError, reloadExams, today } = useData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos os estados");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Exam>(emptyExam);
  const [deleting, setDeleting] = useState<Exam | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { if (new URLSearchParams(window.location.search).has("novo")) setModalOpen(true); }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const list = db.exams.filter(exam => normalize(`${exam.name} ${exam.className || ""}`).includes(normalize(query)) && (filter === "Todos os estados" || examStatus(exam, today) === filter));
  function open(exam?: Exam) { setForm(exam ? { ...exam, answerKey: { ...exam.answerKey } } : emptyExam()); setError(""); setModalOpen(true); }
  function changeQuestions(value: number) {
    const questions = Math.max(1, Math.min(40, value || 1));
    setForm(current => ({ ...current, questions, answerKey: Object.fromEntries(Object.entries(current.answerKey).filter(([number]) => Number(number) <= questions)) as Record<number, Answer> }));
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    if (!form.classId) { setError("Selecione uma turma."); return; }
    if (form.correctionOpensAt < form.applicationDate || form.correctionClosesAt < form.correctionOpensAt) { setError("Confira a ordem das datas de aplicação e correção."); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      const { id, className, ...body } = form;
      void className;
      await apiJson(id ? `/api/exams/${id}` : "/api/exams", { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
      await reloadExams(); setModalOpen(false); setSuccess(id ? "Simulado atualizado." : "Simulado criado.");
      window.history.replaceState(null, "", "/coordenacao/simulados");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o simulado."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true); setError(""); setSuccess("");
    try { await apiJson(`/api/exams/${deleting.id}`, { method: "DELETE" }); await reloadExams(); setDeleting(null); setSuccess("Simulado excluído."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir o simulado."); setDeleting(null); }
    finally { setBusy(false); }
  }
  return <AppShell role="coordenacao" title="Simulados" eyebrow="AVALIAÇÕES" subtitle="Organize simulados, gabaritos e períodos de correção." actions={<button className="button primary" onClick={() => open()}>+ Criar simulado</button>}>
    <div className="summary-strip"><span className="summary-icon">▤</span><div><strong>{db.exams.length} simulados cadastrados</strong><p>{db.exams.filter(exam => examStatus(exam, today) === "Aberto para correção").length} abertos para correção agora.</p></div></div>
    <section className="panel"><div className="panel-heading"><div><h2>Todos os simulados</h2><p>Use os filtros para encontrar uma avaliação.</p></div><div className="filters"><input className="search-input" type="search" placeholder="Buscar simulado..." aria-label="Buscar simulado" value={query} onChange={event => setQuery(event.target.value)} /><select aria-label="Filtrar por estado" value={filter} onChange={event => setFilter(event.target.value)}>{["Todos os estados", "Aguardando aplicação", "Em aplicação", "Aberto para correção", "Fechado para correção"].map(item => <option key={item}>{item}</option>)}</select></div></div>
      {examError && <p className="inline-error" role="alert">{examError}</p>}{error && <p className="inline-error" role="alert">{error}</p>}{success && <p className="inline-success" role="status">{success}</p>}
      {!loaded ? <p className="route-loading">Carregando simulados…</p> : list.length ? <div className="table-scroll"><table><thead><tr><th>Simulado</th><th>Turma</th><th>Aplicação</th><th>Questões</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{list.map(exam => <tr key={exam.id}><td><strong>{exam.name}</strong><small>{Object.keys(exam.answerKey).length}/{exam.questions} respostas no gabarito</small></td><td>{exam.className || "Turma indisponível"}</td><td>{dateLabel(exam.applicationDate)}</td><td>{exam.questions}</td><td><StatusBadge status={examStatus(exam, today)} /></td><td><div className="row-actions"><Link className="text-link" href={`/coordenacao/simulados/${exam.id}`}>Detalhes</Link><button disabled={busy} onClick={() => open(exam)}>Editar</button><button disabled={busy} className="delete-link" onClick={() => setDeleting(exam)}>Excluir</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum simulado encontrado" text="Altere os filtros ou crie um novo simulado." />}
    </section>
    {modalOpen && <Modal wide title={form.id ? "Editar simulado" : "Criar simulado"} description="Defina os dados e selecione a alternativa correta de cada questão." onClose={() => { if (!busy) { setModalOpen(false); window.history.replaceState(null, "", "/coordenacao/simulados"); } }}><form onSubmit={save}><div className="form-grid two"><label className="field span-two">Nome do simulado<input required autoFocus maxLength={120} placeholder="Ex.: Simulado Geral · 3º Ano" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label className="field">Turma<select required value={form.classId} onChange={event => setForm({ ...form, classId: event.target.value })}><option value="">Selecione a turma</option>{db.classes.map(room => <option value={room.id} key={room.id}>{room.name}</option>)}</select></label><label className="field">Quantidade de questões<input type="number" min="1" max="40" required value={form.questions} onChange={event => changeQuestions(Number(event.target.value))} /></label><label className="field">Data de aplicação<input type="date" required value={form.applicationDate} onChange={event => setForm({ ...form, applicationDate: event.target.value })} /></label><label className="field">Abertura para correção<input type="date" required value={form.correctionOpensAt} onChange={event => setForm({ ...form, correctionOpensAt: event.target.value })} /></label><label className="field">Fim da correção<input type="date" required value={form.correctionClosesAt} onChange={event => setForm({ ...form, correctionClosesAt: event.target.value })} /></label></div><div className="answer-heading"><div><h3>Gabarito oficial</h3><p>Selecione uma alternativa por questão. Você pode salvar e voltar para completar depois.</p></div><span>{Object.keys(form.answerKey).length}/{form.questions} preenchidas</span></div><div className="answer-grid">{Array.from({ length: form.questions }, (_, index) => index + 1).map(number => <div className="answer-row" key={number}><strong>Questão {String(number).padStart(2, "0")}</strong><div>{answers.map(answer => <button key={answer} type="button" className={`answer-choice ${form.answerKey[number] === answer ? "selected" : ""}`} aria-label={`Questão ${number}, alternativa ${answer}`} aria-pressed={form.answerKey[number] === answer} onClick={() => setForm(current => ({ ...current, answerKey: { ...current.answerKey, [number]: answer } }))}>{answer}</button>)}</div></div>)}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setModalOpen(false)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? "Salvando…" : "Salvar simulado"}</button></div></form></Modal>}
    {deleting && <ConfirmDialog title="Excluir simulado?" message={`O simulado ${deleting.name} será excluído. Os PDFs já baixados não serão removidos.`} onCancel={() => setDeleting(null)} onConfirm={remove} busy={busy} />}
  </AppShell>;
}
