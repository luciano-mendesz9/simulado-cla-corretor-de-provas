"use client";
import { FormEvent, useState } from "react";
import { Brand } from "@/components/ui";
import { signIn } from "@/lib/login-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (loading) return;
    setError(""); setLoading(true);
    try {
      const destination = await signIn(email, password);
      // Reload the authenticated tree so server layouts and the data provider read the new cookies.
      window.location.replace(destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
      setLoading(false);
    }
  }
  return <main className="login-page">
    <div className="login-intro"><Brand /><div className="login-intro-content"><span className="hero-kicker">PLATAFORMA DE AVALIAÇÕES</span><h1>O jeito simples de organizar cada simulado.</h1><p>Turmas, gabaritos, cartões-resposta e resultados em um espaço pensado para o Colégio Leonel Amorim.</p><div className="login-illustration" aria-hidden="true"><div className="illustration-sheet"><div className="illustration-title">SIMULADO CLA <span>▦</span></div><div className="illustration-line" /><div className="illustration-line short" />{[1,2,3,4,5].map(n => <div className="illustration-answer" key={n}><b>{String(n).padStart(2,"0")}</b><span>○ ○ ● ○ ○</span></div>)}</div><div className="illustration-badge">✓ Gabarito preparado</div></div></div><small>© 2026 Colégio Leonel Amorim</small></div>
    <div className="login-side"><div className="login-card"><span className="login-welcome">BEM-VINDO AO SIMULADO CLA</span><h2>Entre na plataforma</h2><p>Acesse o painel de coordenação ou de professor.</p><form onSubmit={submit}><label className="field">E-mail<input type="email" autoComplete="username" required placeholder="seu.email@cla.edu.br" value={email} onChange={e => setEmail(e.target.value)} /></label><label className="field">Senha<span className="password-control"><input type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Digite sua senha" value={password} onChange={e => setPassword(e.target.value)} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? "Ocultar" : "Mostrar"}</button></span></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full" disabled={loading}>{loading ? "Entrando…" : "Entrar no painel →"}</button></form></div></div>
  </main>;
}
