"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { AppShell, ConfirmDialog, EmptyState, Modal } from "@/components/ui";
import { useData } from "@/components/data-provider";
import { fullName, normalize, Student } from "@/lib/model";
import { apiJson } from "@/lib/client-api";

export function StudentsPage({ turmaId }: { turmaId: string }) {
  const { db, loaded, dataError, reloadAdmin } = useData();
  const room = db.classes.find(c => c.id === turmaId);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", classroomId: turmaId });
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const list = db.students.filter(s => s.classId === turmaId && normalize(fullName(s)).includes(normalize(query)));
  function open(student?: Student) { setEditing(student?.id || null); setForm(student ? { firstName: student.firstName, lastName: student.lastName, classroomId: student.classId } : { firstName: "", lastName: "", classroomId: turmaId }); setError(""); setModalOpen(true); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); setSuccess("");
    try {
      await apiJson(editing ? `/api/admin/students/${editing}` : "/api/admin/students", { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) });
      await reloadAdmin(); setModalOpen(false); setSuccess(editing ? "Aluno atualizado." : "Aluno cadastrado.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar aluno."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return; setBusy(true); setError(""); setSuccess("");
    try { await apiJson(`/api/admin/students/${deleting.id}`, { method: "DELETE" }); await reloadAdmin(); setDeleting(null); setSuccess("Aluno excluído."); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao excluir aluno."); setDeleting(null); }
    finally { setBusy(false); }
  }
  return <AppShell role="coordenacao" title={room ? `Alunos · ${room.name}` : "Alunos"} eyebrow="TURMAS / ALUNOS" subtitle={room ? `Gerencie os alunos vinculados à turma ${room.name}.` : "Volte à lista de turmas para escolher uma turma válida."} actions={room && <button className="button primary" onClick={() => open()}>+ Novo aluno</button>}>
    <Link className="back-link" href="/coordenacao/turmas">← Voltar para turmas</Link>
    {dataError && <p className="inline-error" role="alert">{dataError}</p>}{error && <p className="inline-error" role="alert">{error}</p>}{success && <p className="inline-success" role="status">{success}</p>}
    {!loaded ? <p className="route-loading">Carregando alunos…</p> : room ? <><div className="summary-strip"><span className="summary-icon">♙</span><div><strong>{db.students.filter(s => s.classId === turmaId).length} alunos em {room.name}</strong><p>Alunos cadastrados nesta turma.</p></div></div><section className="panel"><div className="panel-heading"><div><h2>Lista de alunos</h2><p>Nome completo e vínculo com a turma.</p></div><input className="search-input" type="search" placeholder="Buscar aluno..." aria-label="Buscar aluno" value={query} onChange={e => setQuery(e.target.value)} /></div>{list.length ? <div className="table-scroll"><table><thead><tr><th>Aluno</th><th>Turma</th><th>Ações</th></tr></thead><tbody>{list.map(student => <tr key={student.id}><td><div className="name-cell"><span className="name-icon">{student.firstName.slice(0,1)}{student.lastName.slice(0,1)}</span><strong>{fullName(student)}</strong></div></td><td>{room.name}</td><td><div className="row-actions"><button onClick={() => open(student)}>Editar</button><button className="delete-link" onClick={() => setDeleting(student)}>Excluir</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum aluno encontrado" text="Cadastre o primeiro aluno ou altere a busca." />}</section></> : <EmptyState title="Turma não encontrada" />}
    {modalOpen && <Modal title={editing ? "Editar aluno" : "Novo aluno"} description="Informe os dados e selecione a turma." onClose={() => !busy && setModalOpen(false)}><form onSubmit={save}><div className="form-grid two"><label className="field">Nome<input autoFocus required maxLength={80} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></label><label className="field">Sobrenome<input required maxLength={80} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></label><label className="field span-two">Turma<select required value={form.classroomId} onChange={e => setForm({ ...form, classroomId: e.target.value })}>{db.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setModalOpen(false)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? "Salvando…" : "Salvar aluno"}</button></div></form></Modal>}
    {deleting && <ConfirmDialog title="Excluir aluno?" message={`O aluno ${fullName(deleting)} será excluído.`} onCancel={() => setDeleting(null)} onConfirm={remove} busy={busy} />}
  </AppShell>;
}
