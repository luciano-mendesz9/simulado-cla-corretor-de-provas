"use client";

import { useEffect, useRef, useState } from "react";
import { apiJson } from "@/lib/client-api";
import type { ConfirmedCard } from "@/lib/confirmed-card";
import { ConfirmedAnswerCard } from "./confirmed-answer-card";

type Result = { position: number; id: string; studentName: string; correct: number; total: number; percentage: number; confirmedAt: string; confirmedBy: string };

export function CorrectionResults({ examId, refresh }: { examId: string; refresh: number }) {
  const [ranking, setRanking] = useState<Result[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [card, setCard] = useState<ConfirmedCard | null>(null);
  const [cardError, setCardError] = useState("");
  const [cardLoading, setCardLoading] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let active = true;
    apiJson<{ ranking: Result[] }>(`/api/exams/${examId}/results`)
      .then(data => { if (active) { setRanking(data.ranking); setError(""); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar o ranking."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [examId, refresh]);

  useEffect(() => {
    if (!openId) return;
    let active = true;
    apiJson<ConfirmedCard>(`/api/exams/${examId}/results/${openId}`)
      .then(data => { if (active) setCard(data); })
      .catch(cause => { if (active) setCardError(cause instanceof Error ? cause.message : "Não foi possível carregar o gabarito."); })
      .finally(() => { if (active) setCardLoading(false); });
    return () => { active = false; };
  }, [examId, openId]);

  useEffect(() => {
    if (!openId) return;
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenId(null);
        trigger.current?.focus();
      }
      if (event.key === "Tab") {
        event.preventDefault();
        closeButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openId]);

  function closeCard() {
    setOpenId(null);
    trigger.current?.focus();
  }

  function openCard(id: string, button: HTMLButtonElement) {
    trigger.current = button;
    setCard(null);
    setCardError("");
    setCardLoading(true);
    setOpenId(id);
  }

  const selected = ranking.find(item => item.id === openId);
  return <>
    <section className="panel">
      <div className="panel-heading"><div><h2>Resultados confirmados</h2><p>Somente correções revisadas e salvas aparecem no ranking. Empates recebem a mesma posição.</p></div><span className="result-count">{ranking.length} cartão{ranking.length === 1 ? "" : "ões"} corrigido{ranking.length === 1 ? "" : "s"}</span></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {loading ? <p className="route-loading">Carregando resultados…</p> : ranking.length ? <div className="table-scroll"><table><thead><tr><th>Posição</th><th>Aluno</th><th>Acertos</th><th>Percentual</th><th>Confirmado em</th><th>Responsável</th><th>Gabarito</th></tr></thead><tbody>{ranking.map(item => <tr key={item.id}><td><strong>{item.position}º</strong></td><td><strong>{item.studentName}</strong></td><td>{item.correct}/{item.total}</td><td>{item.percentage.toFixed(2)}%</td><td>{new Date(item.confirmedAt).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</td><td>{item.confirmedBy}</td><td><button className="button primary result-answer-button" aria-label={`Ver gabarito de ${item.studentName}`} onClick={event => openCard(item.id, event.currentTarget)}>Ver gabarito</button></td></tr>)}</tbody></table></div> : <p className="muted">Nenhuma correção foi confirmada para este simulado.</p>}
    </section>
    {openId && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeCard(); }}>
      <div className="modal confirmed-card-modal" role="dialog" aria-modal="true" aria-labelledby="confirmed-card-title">
        <div className="modal-header"><div><h2 id="confirmed-card-title">Gabarito de {card?.studentName || selected?.studentName || "aluno"}</h2><p>{card ? `${card.correct}/${card.total} acertos · ${card.className} · ${card.examName}` : "Respostas salvas na confirmação da correção."}</p></div><button ref={closeButton} className="icon-button" aria-label="Fechar gabarito" onClick={closeCard}>×</button></div>
        <div className="confirmed-card-body">
          {cardLoading && <p className="route-loading">Carregando gabarito…</p>}
          {cardError && <p className="inline-error" role="alert">{cardError}</p>}
          {card && <ConfirmedAnswerCard card={card} />}
        </div>
      </div>
    </div>}
  </>;
}
