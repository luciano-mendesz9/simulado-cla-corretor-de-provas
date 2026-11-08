"use client";

import { type FormEvent, useState } from "react";
import Image from "next/image";
import { Brand } from "@/components/ui";
import { signIn } from "@/lib/login-client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const destination = await signIn(email, password);
      window.location.replace(destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
      setLoading(false);
    }
  }

  return <main className="login-screen">
    <div className="login-canvas">
      <header className="login-topbar"><Brand /><span>ACESSO À PLATAFORMA</span></header>
      <div className="login-center">
        <div className="login-decoration left" aria-hidden="true"><span className="login-decor-sheet" /><span className="login-decor-dots" /></div>
        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-panel-logo"><Image src="/simulado-cla-logo.png" alt="" width={64} height={64} priority /></div>
          <span className="login-kicker">PORTAL DE AVALIAÇÕES</span>
          <h1 id="login-title">Bem-vindo de volta</h1>
          <p>Entre com seus dados para acessar o Simulado CLA.</p>
          <form onSubmit={submit}>
            <label className="login-field">E-mail<input type="email" autoComplete="username" required placeholder="seu.email@colegio.com" value={email} onChange={event => setEmail(event.target.value)} /></label>
            <label className="login-field">Senha<span className="login-password"><input type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Digite sua senha" value={password} onChange={event => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? "Ocultar" : "Mostrar"}</button></span></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="login-submit" type="submit" disabled={loading}>{loading ? "Entrando…" : "Entrar na plataforma"}<span aria-hidden="true">→</span></button>
          </form>
        </section>
        <div className="login-decoration right" aria-hidden="true"><span className="login-decor-ring" /><span className="login-decor-dots" /></div>
      </div>
      <footer className="login-footer"><span>© 2026 Colégio Leonel Amorim</span><span>Um espaço para organizar e corrigir seus simulados.</span></footer>
    </div>
  </main>;
}
