export type Role = "coordenacao" | "professor";
export type Answer = "A" | "B" | "C" | "D" | "E";
export const answers: Answer[] = ["A", "B", "C", "D", "E"];
export type ClassRoom = { id: string; name: string; studentCount?: number };
export type Student = { id: string; firstName: string; lastName: string; classId: string };
export type Teacher = { id: string; firstName: string; lastName: string; email: string; status: "ATIVO" | "INATIVO" };
export type Exam = { id: string; name: string; classId: string; className?: string; questions: number; applicationDate: string; correctionOpensAt: string; correctionClosesAt: string; answerKey: Record<number, Answer> };
export type Result = { id: string; examId: string; studentId: string; correct: number; correctedAt: string; correctedBy: string };
export type Database = { classes: ClassRoom[]; students: Student[]; teachers: Teacher[]; exams: Exam[] };

export function fullName(person: { firstName: string; lastName: string }) { return `${person.firstName} ${person.lastName}`.trim(); }
export function dateLabel(value: string) { if (!value) return "—"; const [year, month, day] = value.slice(0, 10).split("-"); return `${day}/${month}/${year}`; }
export function examStatus(exam: Exam, today: string) {
  if (!today) return "Carregando estado";
  if (today < exam.applicationDate) return "Aguardando aplicação";
  if (today < exam.correctionOpensAt) return "Em aplicação";
  if (today <= exam.correctionClosesAt) return "Aberto para correção";
  return "Fechado para correção";
}
export function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
