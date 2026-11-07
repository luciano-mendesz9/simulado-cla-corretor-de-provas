"use client";

import { useRef, useState, type DragEvent } from "react";
import { apiFetch, apiJson } from "@/lib/client-api";
import { openPdf, pdfCards, preparePhoto, type ImageToAnalyze } from "@/lib/correction-files";
import { runPool } from "@/lib/correction-queue";
import type { Exam } from "@/lib/model";
import type { Answer, QuestionReading } from "@/lib/omr/bubble-reader";
import { CorrectionPreview } from "./correction-preview";

type Summary = { total: number; correct: number; incorrect: number; blank: number; multiple: number; review: number; percentage: number };
type Card = { draftId: string; studentId: string; studentName: string; examName: string; className: string; readings: QuestionReading[]; summary: Summary; revision: number; reviewedAt: string | null; previewDataUrl: string; previewWidth: number; previewHeight: number; confirmed?: boolean; error?: string };
type QueueItem = { id: string; name: string; status: "pending" | "processing" | "done" | "error" | "skipped"; error?: string; cards?: number };
type Phase = "select" | "processing" | "review";

export function CorrectionWorkspace({ exam, onResultsChange, onClose }: { exam: Exam; onResultsChange: () => void; onClose: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [phase, setPhase] = useState<Phase>("select");
  const [activeId, setActiveId] = useState("");
  const [manual, setManual] = useState<Record<number, Answer[]>>({});
  const [busy, setBusy] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const active = cards.find(card => card.draftId === activeId) || cards[0];
  const progress = items.filter(item => item.status === "done" || item.status === "error" || item.status === "skipped").length;
  const errors = items.filter(item => item.status === "error").length;
  const ready = cards.filter(card => card.reviewedAt && !card.confirmed && !card.error);

  function addFiles(incoming: File[]) {
    setError("");
    const next = [...files, ...incoming];
    const pdfs = next.filter(file => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length > 1 || (pdfs.length && next.length > 1)) { setError("Selecione até 30 imagens ou um PDF por lote."); return; }
    if (next.length > 30) { setError("Selecione no máximo 30 imagens."); return; }
    const invalid = next.find(file => !pdfs.includes(file) && !/^image\/(jpeg|png|webp)$/.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name));
    if (invalid) { setError(`${invalid.name}: formato não aceito.`); return; }
    setFiles(next);
  }
  function drop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }
  function setStatus(id: string, status: QueueItem["status"], details?: { error?: string; cards?: number }) {
    setItems(current => current.map(item => item.id === id ? { ...item, status, ...details } : item));
  }
  async function upload(image: ImageToAnalyze, batchId: string) {
    if (image.error) throw new Error(image.error);
    const form = new FormData(); form.set("batchId", batchId); form.set("image", image.blob, `${image.name}.jpg`);
    const response = await apiFetch("/api/corrections/analyze", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "A análise falhou.");
    const found = data.cards as Card[];
    setCards(current => [...current, ...found.filter(card => !current.some(existing => existing.draftId === card.draftId))]);
    setActiveId(current => current || found[0]?.draftId || "");
    return found.length;
  }
  async function start() {
    if (!files.length || busy) return;
    setBusy(true); setError(""); setCards([]); setActiveId("");
    let pdf: Awaited<ReturnType<typeof openPdf>> | null = null;
    try {
      const isPdf = files[0].type === "application/pdf" || files[0].name.toLowerCase().endsWith(".pdf");
      if (isPdf) pdf = await openPdf(files[0]);
      const queue: QueueItem[] = pdf ? Array.from({ length: pdf.pages * 2 }, (_, i) => ({ id: `${Math.floor(i / 2) + 1}-${i % 2 + 1}`, name: `${files[0].name} · página ${Math.floor(i / 2) + 1}, cartão ${i % 2 + 1}`, status: "pending" })) : files.map((file, i) => ({ id: String(i), name: file.name, status: "pending" }));
      setItems(queue); setPhase("processing");
      const { batch } = await apiJson<{ batch: { id: string } }>("/api/corrections/batches", { method: "POST", body: JSON.stringify({ examId: exam.id, maxCards: Math.min(60, pdf ? pdf.pages * 2 : files.length * 2) }) });
      setBatchId(batch.id);
      if (pdf) {
        try {
          for await (const image of pdfCards(pdf)) {
            const found = queue.find(item => item.name === image.name);
            if (!found) continue;
            setStatus(found.id, "processing");
            try { const count = await upload(image, batch.id); setStatus(found.id, "done", { cards: count }); }
            catch (cause) { setStatus(found.id, "error", { error: cause instanceof Error ? cause.message : "Falha na análise." }); }
          }
          setItems(current => current.map(item => item.status === "pending" ? { ...item, status: "skipped" } : item));
        } finally { await pdf.destroy(); }
      } else {
        await runPool(files, 2, async (file, index) => {
          const id = String(index);
          setStatus(id, "processing");
          try { const image = await preparePhoto(file); const count = await upload(image, batch.id); setStatus(id, "done", { cards: count }); }
          catch (cause) { setStatus(id, "error", { error: cause instanceof Error ? cause.message : "Falha na análise." }); throw cause; }
        });
      }
      setPhase("review");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o lote."); setPhase("select"); if (pdf) await pdf.destroy().catch(() => {}); }
    finally { setBusy(false); }
  }
  async function retry(item: QueueItem) {
    if (busy || !batchId) return;
    setBusy(true); setStatus(item.id, "processing", { error: undefined });
    try {
      let image: ImageToAnalyze | undefined;
      if (files[0]?.type === "application/pdf" || files[0]?.name.toLowerCase().endsWith(".pdf")) {
        const pdf = await openPdf(files[0]);
        try { for await (const candidate of pdfCards(pdf)) if (candidate.name === item.name) { image = candidate; break; } }
        finally { await pdf.destroy(); }
      } else image = await preparePhoto(files[Number(item.id)]);
      if (!image) throw new Error("Esta metade do PDF está vazia.");
      const count = await upload(image, batchId);
      setStatus(item.id, "done", { cards: count });
    } catch (cause) { setStatus(item.id, "error", { error: cause instanceof Error ? cause.message : "Falha na análise." }); }
    finally { setBusy(false); }
  }
  async function updateDraft(body: object) {
    if (!active) return;
    setBusy(true); setError("");
    try {
      const { draft } = await apiJson<{ draft: Pick<Card, "draftId" | "readings" | "summary" | "revision" | "reviewedAt"> }>(`/api/corrections/drafts/${active.draftId}`, { method: "PATCH", body: JSON.stringify({ revision: active.revision, ...body }) });
      setCards(current => current.map(item => item.draftId === active.draftId ? { ...item, readings: draft.readings, summary: draft.summary, revision: draft.revision, reviewedAt: draft.reviewedAt } : item));
      setManual({});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível revisar o cartão."); }
    finally { setBusy(false); }
  }
  async function confirm(draftIds: string[]) {
    if (!draftIds.length || busy || !window.confirm(`Confirmar definitivamente ${draftIds.length} correção(ões)? As notas passarão a aparecer no ranking.`)) return;
    setBusy(true); setError("");
    try {
      for (let i = 0; i < draftIds.length; i += 30) {
        const { results } = await apiJson<{ results: { draftId: string; ok: boolean; error?: string }[] }>("/api/corrections/confirm", { method: "POST", body: JSON.stringify({ draftIds: draftIds.slice(i, i + 30) }) });
        setCards(current => current.map(card => {
          const result = results.find(item => item.draftId === card.draftId);
          return result ? { ...card, confirmed: result.ok, error: result.error } : card;
        }));
      }
      onResultsChange();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível confirmar as correções."); }
    finally { setBusy(false); }
  }
  function toggle(question: number, answer: Answer, selected: Answer[]) {
    setManual(current => {
      const currentSelected = current[question] || selected;
      return { ...current, [question]: currentSelected.includes(answer) ? currentSelected.filter(item => item !== answer) : [...currentSelected, answer] };
    });
  }

  return <section className="panel correction-workspace"><div className="panel-heading"><div><h2>Corrigir cartões-resposta</h2><p>Envie, confira a leitura de cada aluno e confirme as notas.</p></div><button className="button secondary" disabled={busy} onClick={onClose}>Fechar</button></div>
    <div className="upload-steps"><span className={phase === "select" ? "active" : ""}>1 · Seleção</span><span className={phase === "processing" ? "active" : ""}>2 · Análise</span><span className={phase === "review" ? "active" : ""}>3 · Revisão e confirmação</span></div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {phase === "select" && <><div className="dropzone correction-dropzone" onDragOver={event => event.preventDefault()} onDrop={drop} onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={event => { if (event.key === "Enter") input.current?.click(); }}><span>↥</span><strong>Arraste imagens ou um PDF para cá</strong><small>JPEG, PNG, WebP (até 30 imagens) ou um PDF A4 de até 15 páginas. Cada imagem será enviada separadamente.</small><input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ""; }} onClick={event => event.stopPropagation()} /></div>
      {files.length > 0 && <div className="correction-files"><strong>Arquivos selecionados ({files.length})</strong>{files.map((file, i) => <div key={`${file.name}-${i}`}><span>{file.name} <small>{(file.size / 1_000_000).toFixed(1)} MB</small></span><button type="button" onClick={() => setFiles(current => current.filter((_, index) => index !== i))} aria-label={`Remover ${file.name}`}>Remover</button></div>)}</div>}
      <p className="muted">Fotos devem mostrar os quatro marcadores e o QR com nitidez. PDFs são renderizados no navegador; as imagens originais não são guardadas no banco.</p><button className="button primary" disabled={!files.length || busy} onClick={start}>{busy ? "Preparando…" : "Iniciar análise"}</button></>}
    {(phase === "processing" || phase === "review") && <div className="correction-progress"><div className="correction-progress-head"><strong>{phase === "processing" ? "Analisando arquivos" : "Análise concluída"}</strong><span>{progress}/{items.length} finalizados · {Math.max(0, items.length - progress)} pendentes · {errors} com erro</span></div><progress max={Math.max(1, items.length)} value={progress} />{items.some(item => item.status === "error") && <div className="correction-queue">{items.map(item => <div key={item.id}><span>{item.name}</span><strong>{item.status === "error" ? item.error : item.status === "skipped" ? "Metade vazia" : item.status === "done" ? `${item.cards || 0} cartão(ões) lido(s)` : item.status === "processing" ? "Analisando…" : "Aguardando"}</strong>{phase === "review" && item.status === "error" && <button className="button secondary" disabled={busy} onClick={() => retry(item)}>Tentar novamente</button>}</div>)}</div>}</div>}
    {phase === "review" && <><div className="correction-review-head"><h3>Cartões identificados ({cards.length})</h3><button className="button primary" disabled={!ready.length || busy} onClick={() => confirm(ready.map(card => card.draftId))}>Confirmar válidos em lote ({ready.length})</button></div>
      {!cards.length && <p className="muted">Nenhum cartão pôde ser identificado. Confira os erros e tente novamente com fotos melhores.</p>}
      <div className="correction-card-list">{cards.map(card => <button key={card.draftId} className={`correction-card-item ${active?.draftId === card.draftId ? "selected" : ""}`} onClick={() => { setActiveId(card.draftId); setManual({}); }}><strong>{card.studentName}</strong><span>{card.className} · {card.examName}</span><small>{card.summary.correct} acertos · {card.summary.incorrect} erros · {card.summary.blank} em branco · {card.summary.multiple} múltiplas</small><em>{card.confirmed ? "Confirmada" : card.error || (card.summary.review ? `${card.summary.review} para revisar` : card.reviewedAt ? "Revisada" : "Aguardando conferência")}</em></button>)}</div>
      {active && <div className="correction-active"><div className="correction-active-head"><div><h3>{active.studentName}</h3><p>{active.className} · {active.examName} · {active.summary.percentage.toFixed(2)}% de acertos</p></div><span>{active.confirmed ? "Confirmada" : active.reviewedAt ? "Revisada" : active.summary.review ? "Revisão necessária" : "Aguardando conferência"}</span></div>
        <CorrectionPreview card={active} />
        {active.readings.filter(item => item.status === "REVISAO_NECESSARIA").map(item => <div className="correction-manual" key={item.question}><strong>Questão {item.question}: leitura inconclusiva</strong><p>Confira a imagem e indique explicitamente as alternativas preenchidas. Deixe todas desmarcadas para resposta em branco.</p><div>{(["A", "B", "C", "D", "E"] as Answer[]).map(answer => <button key={answer} className={`answer-choice ${(manual[item.question] || item.selected).includes(answer) ? "selected" : ""}`} onClick={() => toggle(item.question, answer, item.selected)} aria-pressed={(manual[item.question] || item.selected).includes(answer)}>{answer}</button>)}</div><button className="button secondary" disabled={busy} onClick={() => updateDraft({ question: item.question, selected: manual[item.question] || item.selected })}>Salvar decisão manual</button></div>)}
        <div className="correction-confirm-actions"><button className="button secondary" disabled={busy || !!active.confirmed || !!active.reviewedAt || !!active.summary.review || !active.previewDataUrl} onClick={() => updateDraft({ review: true })}>Marcar cartão como revisado</button><button className="button primary" disabled={busy || !!active.confirmed || !active.reviewedAt} onClick={() => confirm([active.draftId])}>Confirmar esta correção</button></div>{active.error && <p className="inline-error" role="alert">{active.error}</p>}</div>}
      <button className="button secondary" onClick={() => { setPhase("select"); setFiles([]); setItems([]); setCards([]); setActiveId(""); setBatchId(""); }}>Iniciar outro lote</button></>}
  </section>;
}
