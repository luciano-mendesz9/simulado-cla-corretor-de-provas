"use client";
import { FormEvent, useState } from "react";
import { AppShell, ConfirmDialog, EmptyState, Modal, StatusBadge } from "@/components/ui";
import { useData } from "@/components/data-provider";
import { fullName, normalize, Teacher } from "@/lib/model";
import { apiJson } from "@/lib/client-api";

const blank = { firstName: "", lastName: "", email: "", status: "ATIVO" as const, password: "" };
export default function TeachersPage() {
  const { db, loaded, dataError, reloadAdmin } = useData();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<{ firstName: string; lastName: string; email: string; status: "ATIVO" | "INATIVO"; password: string }>(blank);
  const [deleting, setDeleting] = useState<Teacher | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const list = db.teachers.filter(t => normalize(fullName(t) + " " + t.email).includes(normalize(query)));
  function open(teacher?: Teacher) { setEditing(teacher?.id || null); setForm(teacher ? { firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email, status: teacher.status, password: "" } : blank); setError(""); setModalOpen(true); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); setSuccess("");
    try {
      const body = { firstName: form.firstName, lastName: form.lastName, email: form.email, status: form.status, ...(!editing ? { password: form.password } : {}) };
      await apiJson(editing ? `/api/admin/teachers/${editing}` : "/api/admin/teachers", { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
      await reloadAdmin(); setForm(blank); setModalOpen(false); setSuccess(editing ? "Professor atualizado." : "Professor cadastrado.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar professor."); }
    finally { setBusy(false); }
  }
  async function toggle(teacher: Teacher) {
    if (busy) return; setBusy(true); setError(""); setSuccess("");
    try {
      await apiJson(`/api/admin/teachers/${teacher.id}`, { method: "PATCH", body: JSON.stringify({ firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email, status: teacher.status === "ATIVO" ? "INATIVO" : "ATIVO" }) });
      await reloadAdmin(); setSuccess(teacher.status === "ATIVO" ? "Professor inativado. As sessões foram encerradas." : "Professor ativado.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao alterar status."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return; setBusy(true); setError(""); setSuccess("");
    try { await apiJson(`/api/admin/teachers/${deleting.id}`, { method: "DELETE" }); await reloadAdmin(); setDeleting(null); setSuccess("Professor excluído."); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao excluir professor."); setDeleting(null); }
    finally { setBusy(false); }
  }
  return <AppShell role="coordenacao" title="Professores" eyebrow="EQUIPE PEDAGÓGICA" subtitle="Cadastre professores e acompanhe o status de suas contas." actions={<button className="button primary" onClick={() => open()}>+ Novo professor</button>}>
    <div className="summary-strip"><span className="summary-icon">♧</span><div><strong>{db.teachers.length} professores cadastrados</strong><p>{db.teachers.filter(t => t.status === "ATIVO").length} ativos · {db.teachers.filter(t => t.status === "INATIVO").length} inativos</p></div></div>
    <section className="panel"><div className="panel-heading"><div><h2>Equipe cadastrada</h2><p>Nome, e-mail e status da conta.</p></div><input className="search-input" type="search" placeholder="Buscar professor..." aria-label="Buscar professor" value={query} onChange={e => setQuery(e.target.value)} /></div>
      {dataError && <p className="inline-error" role="alert">{dataError}</p>}{error && <p className="inline-error" role="alert">{error}</p>}{success && <p className="inline-success" role="status">{success}</p>}
      {!loaded ? <p className="route-loading">Carregando professores…</p> : list.length ? <div className="table-scroll"><table><thead><tr><th>Professor</th><th>E-mail</th><th>Status</th><th>Ações</th></tr></thead><tbody>{list.map(teacher => <tr key={teacher.id}><td><div className="name-cell"><span className="name-icon">{teacher.firstName.slice(0,1)}{teacher.lastName.slice(0,1)}</span><strong>{fullName(teacher)}</strong></div></td><td>{teacher.email}</td><td><StatusBadge status={teacher.status === "ATIVO" ? "Ativo" : "Inativo"} /></td><td><div className="row-actions"><button disabled={busy} onClick={() => open(teacher)}>Editar</button><button disabled={busy} onClick={() => toggle(teacher)}>{teacher.status === "ATIVO" ? "Desativar" : "Ativar"}</button><button disabled={busy} className="delete-link" onClick={() => setDeleting(teacher)}>Excluir</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum professor encontrado" text="Tente outro termo ou cadastre um professor." />}
    </section>
    {modalOpen && <Modal title={editing ? "Editar professor" : "Novo professor"} description={editing ? "A senha atual será mantida." : "Crie a conta com uma senha inicial segura."} onClose={() => !busy && setModalOpen(false)}><form onSubmit={save}><div className="form-grid two"><label className="field">Nome<input required autoFocus maxLength={80} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></label><label className="field">Sobrenome<input required maxLength={80} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></label><label className="field">E-mail<input type="email" required maxLength={160} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label><label className="field">Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as "ATIVO" | "INATIVO" })}><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></label>{!editing && <label className="field span-two">Senha inicial<input type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setModalOpen(false)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? "Salvando…" : "Salvar professor"}</button></div></form></Modal>}
    {deleting && <ConfirmDialog title="Excluir professor?" message={`A conta de ${fullName(deleting)} será excluída e suas sessões encerradas.`} onCancel={() => setDeleting(null)} onConfirm={remove} busy={busy} />}
  </AppShell>;
}
