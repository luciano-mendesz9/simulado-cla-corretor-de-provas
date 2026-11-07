"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { AppShell, ConfirmDialog, EmptyState, Modal } from "@/components/ui";
import { useData } from "@/components/data-provider";
import { ClassRoom, normalize } from "@/lib/model";
import { apiJson } from "@/lib/client-api";

export default function ClassesPage() {
  const { db, loaded, dataError, reloadAdmin } = useData();
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<ClassRoom | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const list = db.classes.filter(c => normalize(c.name).includes(normalize(query)));
  function open(room?: ClassRoom) { setEditing(room?.id || null); setName(room?.name || ""); setError(""); setModalOpen(true); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await apiJson(editing ? `/api/admin/classrooms/${editing}` : "/api/admin/classrooms", { method: editing ? "PATCH" : "POST", body: JSON.stringify({ name }) });
      await reloadAdmin(); setModalOpen(false); setSuccess(editing ? "Turma atualizada." : "Turma cadastrada.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar turma."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return; setBusy(true); setError(""); setSuccess("");
    try { await apiJson(`/api/admin/classrooms/${deleting.id}`, { method: "DELETE" }); await reloadAdmin(); setDeleting(null); setSuccess("Turma excluída."); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao excluir turma."); setDeleting(null); }
    finally { setBusy(false); }
  }
  return <AppShell role="coordenacao" title="Turmas" eyebrow="ORGANIZAÇÃO ESCOLAR" subtitle="Cadastre turmas e acompanhe os alunos de cada uma." actions={<button className="button primary" onClick={() => open()}>+ Nova turma</button>}>
    <div className="summary-strip"><span className="summary-icon">▦</span><div><strong>{db.classes.length} turmas cadastradas</strong><p>Selecione uma turma para ver ou gerenciar seus alunos.</p></div></div>
    <section className="panel"><div className="panel-heading"><div><h2>Turmas cadastradas</h2><p>Organize as turmas por nome.</p></div><input className="search-input" type="search" placeholder="Buscar turma..." aria-label="Buscar turma" value={query} onChange={e => setQuery(e.target.value)} /></div>
      {dataError && <p className="inline-error" role="alert">{dataError}</p>}{error && <p className="inline-error" role="alert">{error}</p>}{success && <p className="inline-success" role="status">{success}</p>}
      {!loaded ? <p className="route-loading">Carregando turmas…</p> : list.length ? <div className="table-scroll"><table><thead><tr><th>Turma</th><th>Alunos</th><th>Ações</th></tr></thead><tbody>{list.map(room => <tr key={room.id}><td><div className="name-cell"><span className="name-icon">{room.name.slice(0, 2)}</span><strong>{room.name}</strong></div></td><td>{room.studentCount ?? db.students.filter(s => s.classId === room.id).length}</td><td><div className="row-actions"><Link className="text-link" href={`/coordenacao/turmas/${room.id}/alunos`}>Ver alunos</Link><button onClick={() => open(room)}>Editar</button><button className="delete-link" onClick={() => setDeleting(room)}>Excluir</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhuma turma encontrada" text="Tente outro termo ou cadastre uma nova turma." />}
    </section>
    {modalOpen && <Modal title={editing ? "Editar turma" : "Nova turma"} description="Informe o nome da turma." onClose={() => !busy && setModalOpen(false)}><form onSubmit={save}><div className="form-grid"><label className="field">Nome da turma<input required autoFocus maxLength={80} placeholder="Ex.: 3º Ano A" value={name} onChange={e => setName(e.target.value)} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setModalOpen(false)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? "Salvando…" : "Salvar turma"}</button></div></form></Modal>}
    {deleting && <ConfirmDialog title="Excluir turma?" message={`A turma ${deleting.name} será excluída. Alunos vinculados impedem a exclusão.`} onCancel={() => setDeleting(null)} onConfirm={remove} busy={busy} />}
  </AppShell>;
}
