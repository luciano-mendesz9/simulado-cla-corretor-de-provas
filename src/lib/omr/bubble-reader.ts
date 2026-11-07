export type Answer = "A" | "B" | "C" | "D" | "E";
export type AnswerStatus = "CORRETA" | "INCORRETA" | "EM_BRANCO" | "MULTIPLA_MARCACAO" | "REVISAO_NECESSARIA";
export type QuestionReading = {
  question: number;
  selected: Answer[];
  correct: Answer;
  status: AnswerStatus;
  scores: Record<Answer, number>;
  centers: Record<Answer, { x: number; y: number }>;
  manual: boolean;
};
export function classify(selected: Answer[], correct: Answer, ambiguous = false): AnswerStatus {
  if (ambiguous) return "REVISAO_NECESSARIA";
  if (selected.length > 1) return "MULTIPLA_MARCACAO";
  if (!selected.length) return "EM_BRANCO";
  return selected[0] === correct ? "CORRETA" : "INCORRETA";
}
export function summarize(readings: QuestionReading[]) {
  const count = (status: AnswerStatus) => readings.filter(item => item.status === status).length;
  const correct = count("CORRETA"), incorrect = count("INCORRETA"), blank = count("EM_BRANCO"), multiple = count("MULTIPLA_MARCACAO"), review = count("REVISAO_NECESSARIA");
  return { total: readings.length, correct, incorrect, blank, multiple, review, percentage: readings.length ? Math.round(correct / readings.length * 10000) / 100 : 0 };
}
