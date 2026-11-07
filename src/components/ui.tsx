"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useData } from "./data-provider";
import { Role, examStatus } from "@/lib/model";

const coordinatorLinks = [
  { href: "/coordenacao", label: "Visão geral", icon: "◫" },
  { href: "/coordenacao/turmas", label: "Turmas e alunos", icon: "▦" },
  { href: "/coordenacao/professores", label: "Professores", icon: "♙" },
  { href: "/coordenacao/simulados", label: "Simulados", icon: "▤" },
];
const teacherLinks = [
  { href: "/professor", label: "Meus simulados", icon: "▤" },
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><span className="brand-mark" aria-hidden="true">✓</span><span><strong>Simulado <em>CLA</em></strong>{!compact && <small>COLÉGIO LEONEL AMORIM</small>}</span></div>;
}

export function AppShell({ role, title, eyebrow, subtitle, actions, children }: { role: Role; title: string; eyebrow?: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter();
  const { session, logout, db, today } = useData();
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  async function exit() { if (loggingOut) return; setLoggingOut(true); setLogoutError(""); try { await logout(); router.replace("/login"); router.refresh(); } catch (error) { setLogoutError(error instanceof Error ? error.message : "Falha ao sair."); setLoggingOut(false); } }
  const [menuOpen, setMenuOpen] = useState(false);
  const links = role === "coordenacao" ? coordinatorLinks : teacherLinks;
  const activeHref = role === "professor" ? "/professor" : title === "Visão geral" ? "/coordenacao" : title.startsWith("Turmas") || title.startsWith("Alunos") ? "/coordenacao/turmas" : title === "Professores" ? "/coordenacao/professores" : "/coordenacao/simulados";
  const openExams = db.exams.filter(e => examStatus(e, today) === "Aberto para correção").length;
  return <div className="app-shell">
    <button className={`mobile-overlay ${menuOpen ? "visible" : ""}`} aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />
    <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
      <Link href={role === "coordenacao" ? "/coordenacao" : "/professor"} onClick={() => setMenuOpen(false)}><Brand /></Link>
      <div className="nav-section-label">MENU PRINCIPAL</div>
      <nav className="nav-list" aria-label="Menu principal">
        {links.map(link => <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className={`nav-link ${activeHref === link.href ? "selected" : ""}`}><span aria-hidden="true" className="nav-icon">{link.icon}</span>{link.label}{link.href.endsWith("simulados") && openExams > 0 && <span className="nav-count">{openExams}</span>}</Link>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card"><span className="help-symbol">✦</span><strong>Fluxo de trabalho</strong><p>{role === "coordenacao" ? "Organize turmas, crie simulados e prepare os cartões para impressão." : "Consulte as datas e abra os simulados disponíveis para correção."}</p><Link href={role === "coordenacao" ? "/coordenacao/simulados" : "/professor"}>Ver simulados →</Link></div>
        <div className="sidebar-profile"><span className="avatar">{role === "coordenacao" ? "CM" : "PR"}</span><span><strong>{role === "coordenacao" ? "Coordenação CLA" : "Professor CLA"}</strong><small>{session?.email || "Carregando usuário…"}</small></span></div>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="topbar-left"><button className="menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">☰</button><span>{role === "coordenacao" ? "Coordenação" : "Professor"}</span><span className="crumb-separator">/</span><strong>{title}</strong></div><div className="topbar-right"><span className="demo-pill">● Dados do servidor</span><button className="topbar-exit" disabled={loggingOut} onClick={exit}>{loggingOut ? "Saindo…" : "Sair"}</button><span className="avatar top-avatar">{role === "coordenacao" ? "CM" : "PR"}</span></div></header>
      <main className="main-content"><div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{subtitle && <p className="subtitle">{subtitle}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>{logoutError && <p className="inline-error" role="alert">{logoutError}</p>}{children}<p className="demo-footnote">As notas entram no ranking somente depois da revisão e confirmação explícita. Valide cartões físicos antes do uso operacional.</p></main>
    </div>
  </div>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status.includes("Aberto") || status === "Ativo" ? "green" : status.includes("Aguardando") ? "amber" : status.includes("Fechado") || status === "Inativo" ? "gray" : "blue";
  return <span className={`status-badge ${tone}`}><span className="status-dot" />{status}</span>;
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-symbol">◎</span><h3>{title}</h3>{text && <p>{text}</p>}{action}</div>;
}

export function Modal({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div><div className="modal-body">{children}</div></section></div>;
}

export function ConfirmDialog({ title, message, onCancel, onConfirm, busy = false }: { title: string; message: string; onCancel: () => void; onConfirm: () => void; busy?: boolean }) {
  return <Modal title={title} onClose={onCancel}><p className="confirm-message">{message}</p><div className="form-actions"><button className="button secondary" disabled={busy} onClick={onCancel}>Cancelar</button><button className="button danger" disabled={busy} onClick={onConfirm}>{busy ? "Excluindo…" : "Excluir"}</button></div></Modal>;
}
