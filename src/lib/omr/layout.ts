/** Coordinates are PDF points, measured from the top left of one A4 half-sheet. */
import layout from "../../../python/shared/card-layout.v2.json";
export const CARD_LAYOUT = layout;

export type Point = { x: number; y: number };
export type Bubble = Point & { question: number; answer: "A" | "B" | "C" | "D" | "E" };
const letters = ["A", "B", "C", "D", "E"] as const;
export function bubblesFor(questions: number): Bubble[] {
  if (!Number.isInteger(questions) || questions < 1 || questions > CARD_LAYOUT.maxQuestions) throw new Error("Quantidade de questões incompatível com o cartão.");
  const rows = Math.ceil(questions / 4);
  return Array.from({ length: questions }, (_, index) => {
    const column = Math.floor(index / rows);
    const row = index % rows;
    return letters.map((answer, choice) => ({
      question: index + 1,
      answer,
      x: CARD_LAYOUT.columnX[column] + CARD_LAYOUT.bubbleX[choice],
      y: CARD_LAYOUT.firstRowY + row * CARD_LAYOUT.rowStep,
    }));
  }).flat();
}
