"use client";

import { CARD_LAYOUT, bubblesFor } from "@/lib/omr/layout";
import { bubblePaint, type ConfirmedCard } from "@/lib/confirmed-card";
import { dateLabel } from "@/lib/model";

const paint = {
  "correct-selected": { fill: "#15956c", opacity: 1, label: "correta e marcada" },
  "correct-missed": { fill: "#15956c", opacity: .28, label: "correta, não marcada" },
  "wrong-selected": { fill: "#d63343", opacity: 1, label: "marcada incorretamente" },
  empty: { fill: "#fff", opacity: 1, label: "não marcada" },
} as const;

function Marker({ x, y, dots }: { x: number; y: number; dots: number }) {
  const size = CARD_LAYOUT.markerSize;
  return <g aria-hidden="true">
    <rect x={x - size / 2} y={y - size / 2} width={size} height={size} fill="#000" />
    <rect x={x - size / 2 + 3} y={y - size / 2 + 3} width={size - 6} height={size - 6} fill="#fff" />
    {([[-3, -3], [3, -3], [-3, 3], [3, 3]] as const).slice(0, dots).map(([dx, dy]) =>
      <rect key={`${dx}-${dy}`} x={x + dx - 1.1} y={y + dy - 1.1} width="2.2" height="2.2" fill="#000" />)}
  </g>;
}

export function ConfirmedAnswerCard({ card }: { card: ConfirmedCard }) {
  const saved = new Map(card.answers.map(answer => [answer.question, answer]));
  const footer = CARD_LAYOUT.height - 39;
  return <div className="confirmed-answer-card">
    <div className="confirmed-card-scroll">
      <svg viewBox={`0 0 ${CARD_LAYOUT.width} ${CARD_LAYOUT.height}`} role="img" aria-label={`Gabarito confirmado de ${card.studentName}`} xmlns="http://www.w3.org/2000/svg">
        <rect width={CARD_LAYOUT.width} height={CARD_LAYOUT.height} fill="#fff" />
        {CARD_LAYOUT.markers.map(marker => <Marker key={marker.id} x={marker.x} y={marker.y} dots={marker.id} />)}
        <g fontFamily="Arial, sans-serif" fill="#292f3b">
          <text x="31" y="30" fontSize="10" fontWeight="bold" fill="#f36b32">COLÉGIO LEONEL AMORIM</text>
          <text x="31" y="44" fontSize="8" fontWeight="bold">CARTÃO-RESPOSTA</text>
          <text x="31" y="61" fontSize="9" fontWeight="bold">{card.examName.slice(0, 62)}</text>
          <text x="31" y="77" fontSize="9">Aluno: {card.studentName.slice(0, 45)}</text>
          <text x="31" y="91" fontSize="8">Turma: {card.className.slice(0, 34)}</text>
          <text x="301" y="91" fontSize="8">Aplicação: {dateLabel(card.applicationDate)}</text>
          <rect x={CARD_LAYOUT.qr.x} y={CARD_LAYOUT.qr.y} width={CARD_LAYOUT.qr.size} height={CARD_LAYOUT.qr.size} rx="4" fill="#fff7f1" stroke="#f36b32" strokeWidth="1" />
          <text x={CARD_LAYOUT.qr.x + CARD_LAYOUT.qr.size / 2} y="56" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#dc5622">GABARITO</text>
          <text x={CARD_LAYOUT.qr.x + CARD_LAYOUT.qr.size / 2} y="69" textAnchor="middle" fontSize="7" fill="#dc5622">CONFIRMADO</text>
          <text x="31" y="105" fontSize="6.5" fill="#6e7882">Resultado salvo após a revisão</text>
          <line x1="31" y1="111" x2={CARD_LAYOUT.width - 31} y2="111" stroke="#6e7882" strokeWidth=".6" />
          <text x="31" y="123" fontSize="7" fill="#6e7882">Verde: resposta correta · Vermelho: marcação incorreta</text>
          {bubblesFor(card.total).map(bubble => {
            const answer = saved.get(bubble.question);
            if (!answer) return null;
            const state = bubblePaint(bubble.answer, answer);
            const color = paint[state];
            return <g key={`${bubble.question}-${bubble.answer}`}>
              {bubble.answer === "A" && <text x={bubble.x - 26} y={bubble.y + 2.2} fontSize="7" fontWeight="bold">{String(bubble.question).padStart(2, "0")}</text>}
              <circle cx={bubble.x} cy={bubble.y} r={CARD_LAYOUT.bubbleRadius} fill={color.fill} fillOpacity={color.opacity} stroke="#292f3b" strokeWidth=".75">
                <title>{`Questão ${bubble.question}, alternativa ${bubble.answer}: ${color.label}`}</title>
              </circle>
              <text x={bubble.x + 6.3} y={bubble.y + 2.2} fontSize="6.6">{bubble.answer}</text>
            </g>;
          })}
          <line x1="40" y1={footer} x2="249" y2={footer} stroke="#6e7882" strokeWidth=".5" />
          <text x="31" y={footer + 11} fontSize="6.5" fill="#6e7882">Assinatura do aluno</text>
          <text x="302" y={footer + 11} fontSize="6.3" fill="#6e7882">Gabarito individual confirmado</text>
        </g>
      </svg>
    </div>
    <div className="confirmed-card-legend" aria-label="Legenda das bolinhas">
      <span><i className="correct-missed" /> Correta, não marcada</span>
      <span><i className="correct-selected" /> Correta e marcada</span>
      <span><i className="wrong-selected" /> Marcada incorretamente</span>
    </div>
  </div>;
}
