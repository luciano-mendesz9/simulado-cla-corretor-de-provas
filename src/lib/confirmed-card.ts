import type { Answer, AnswerStatus } from "@/lib/omr/bubble-reader";

export type ConfirmedAnswer = {
  question: number;
  selected: Answer[];
  correct: Answer;
  status: AnswerStatus;
};

export type ConfirmedCard = {
  id: string;
  studentName: string;
  className: string;
  examName: string;
  applicationDate: string;
  total: number;
  correct: number;
  answers: ConfirmedAnswer[];
};

export type BubblePaint = "correct-selected" | "correct-missed" | "wrong-selected" | "empty";

export function bubblePaint(answer: Answer, saved: ConfirmedAnswer): BubblePaint {
  if (answer === saved.correct) return saved.selected.includes(answer) ? "correct-selected" : "correct-missed";
  return saved.selected.includes(answer) ? "wrong-selected" : "empty";
}
