"use client";

import { useState } from "react";
import type { Answer, QuestionReading } from "@/lib/omr/bubble-reader";

export type PreviewCard = { previewDataUrl: string; previewWidth: number; previewHeight: number; readings: QuestionReading[] };
type Mark = { question: number; answer: Answer; color: "orange" | "green" | "red"; x: number; y: number };
export function overlayMarks(readings: QuestionReading[]): Mark[] {
  return readings.flatMap<Mark>(item => {
    if (item.status === "REVISAO_NECESSARIA") return [];
    if (item.status === "MULTIPLA_MARCACAO") return item.selected.map(answer => ({ question: item.question, answer, color: "red" as const, ...item.centers[answer] }));
    if (item.status === "CORRETA") return [{ question: item.question, answer: item.selected[0], color: "orange" as const, ...item.centers[item.selected[0]] }];
    return [
      ...item.selected.map(answer => ({ question: item.question, answer, color: "orange" as const, ...item.centers[answer] })),
      { question: item.question, answer: item.correct, color: "green" as const, ...item.centers[item.correct] },
    ];
  });
}

export function CorrectionPreview({ card }: { card: PreviewCard }) {
  const [zoom, setZoom] = useState(.5);
  const marks = overlayMarks(card.readings);
  const colors = { orange: "#f36b32", green: "#15956c", red: "#d63343" };
  return <div className="correction-preview">
    <div className="correction-preview-toolbar"><strong>Prévia do cartão analisado</strong><div><button className="button secondary" onClick={() => setZoom(z => Math.max(.35, z - .15))} aria-label="Reduzir zoom">−</button><span>{Math.round(zoom * 100)}%</span><button className="button secondary" onClick={() => setZoom(z => Math.min(1.5, z + .15))} aria-label="Aumentar zoom">+</button></div></div>
    <div className="correction-preview-scroll"><svg role="img" aria-label="Cartão processado com indicadores das respostas" viewBox={`0 0 ${card.previewWidth} ${card.previewHeight}`} style={{ width: `${Math.round(card.previewWidth * zoom)}px`, height: `${Math.round(card.previewHeight * zoom)}px` }}>
      <image href={card.previewDataUrl} x="0" y="0" width={card.previewWidth} height={card.previewHeight} />
      {marks.map(mark => <g key={`${mark.question}-${mark.answer}-${mark.color}`} transform={`translate(${mark.x} ${mark.y})`} style={{ color: colors[mark.color] }}><title>Questão {mark.question}, alternativa {mark.answer}: {mark.color === "green" ? "resposta correta" : mark.color === "red" ? "múltipla marcação" : "marcação do aluno"}</title><circle r="13" fill="white" fillOpacity=".88" stroke="currentColor" strokeWidth="3" /><path d="M-5 -5L5 5M5 -5L-5 5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></g>)}
      {card.readings.filter(item => item.status === "REVISAO_NECESSARIA").map(item => <g key={`review-${item.question}`} transform={`translate(${item.centers.A.x - 27} ${item.centers.A.y})`}><circle r="13" fill="#fff8e7" stroke="#b78026" strokeWidth="3" /><text textAnchor="middle" dominantBaseline="central" fill="#b78026" fontSize="19" fontWeight="bold">?</text><title>Questão {item.question}: revisão necessária</title></g>)}
    </svg></div>
    <div className="correction-legend"><span><i className="orange" /> X laranja: marcação do aluno</span><span><i className="green" /> X verde: resposta correta</span><span><i className="red" /> X vermelho: múltipla marcação</span><span><i className="amber" /> ?: leitura inconclusiva</span></div>
  </div>;
}
