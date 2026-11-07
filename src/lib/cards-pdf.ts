import { PDFDocument, StandardFonts, rgb, type PdfFont, type PdfPage } from "@/lib/vendor/pdf-lib.min.js";
import * as QRCode from "@/lib/vendor/qrcode/core/qrcode";
import type { Exam } from "@/lib/model";
import { CARD_LAYOUT, bubblesFor } from "@/lib/omr/layout";
import { makeCardQr } from "@/lib/omr/card-qr";

type CardStudent = { id: string; firstName: string; lastName: string };
const PAGE_WIDTH = CARD_LAYOUT.width;
const PAGE_HEIGHT = CARD_LAYOUT.height * 2;
const HALF_HEIGHT = PAGE_HEIGHT / 2;
const orange = rgb(0.953, 0.42, 0.196);
const dark = rgb(0.16, 0.19, 0.23);
const gray = rgb(0.43, 0.47, 0.51);
const black = rgb(0, 0, 0);

function safeText(value: string, font: PdfFont) {
  return [...value.normalize("NFC").replace(/[\p{Cc}\s]+/gu, " ")].map(char => {
    try { font.encodeText(char); return char; } catch { return "?"; }
  }).join("");
}
function fit(value: string, font: PdfFont, size: number, maxWidth: number) {
  const clean = safeText(value, font);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let shortened = clean;
  while (shortened && font.widthOfTextAtSize(shortened + "...", size) > maxWidth) shortened = shortened.slice(0, -1);
  return shortened + "...";
}
function card(page: PdfPage, slot: number, exam: Exam, roomName: string, student: CardStudent, regular: PdfFont, bold: PdfFont) {
  const top = slot * HALF_HEIGHT;
  const y = (offset: number) => PAGE_HEIGHT - top - offset;
  const text = (value: string, x: number, offset: number, size: number, font = regular, color = dark) =>
    page.drawText(safeText(value, font), { x, y: y(offset), size, font, color });

  // A framed marker has 1, 2, 3 or 4 isolated dots. Its count identifies the corner
  // after arbitrary rotation; the four centers define the card homography.
  for (const marker of CARD_LAYOUT.markers) {
    const left = marker.x - CARD_LAYOUT.markerSize / 2;
    const upper = marker.y - CARD_LAYOUT.markerSize / 2;
    page.drawRectangle({ x: left, y: y(upper + CARD_LAYOUT.markerSize), width: CARD_LAYOUT.markerSize, height: CARD_LAYOUT.markerSize, color: black });
    page.drawRectangle({ x: left + 3, y: y(upper + CARD_LAYOUT.markerSize - 3), width: CARD_LAYOUT.markerSize - 6, height: CARD_LAYOUT.markerSize - 6, color: rgb(1, 1, 1) });
    const dots = [[-3, -3], [3, -3], [-3, 3], [3, 3]];
    for (const [dx, dy] of dots.slice(0, marker.id)) {
      page.drawRectangle({ x: marker.x + dx - 1.1, y: y(marker.y + dy + 1.1), width: 2.2, height: 2.2, color: black });
    }
  }
  text("COLÉGIO LEONEL AMORIM", 31, 30, 10, bold, orange);
  text("CARTÃO-RESPOSTA", 31, 44, 8, bold);
  text(fit(exam.name, bold, 9, 420), 31, 61, 9, bold);
  text(`Aluno: ${fit(`${student.firstName} ${student.lastName}`, regular, 9, 330)}`, 31, 77, 9);
  text(`Turma: ${fit(roomName, regular, 8, 260)}`, 31, 91, 8);
  text(`Aplicação: ${exam.applicationDate.split("-").reverse().join("/")}`, 301, 91, 8);

  const qr = QRCode.create(makeCardQr(exam.id, student.id), { errorCorrectionLevel: "M" } as Parameters<typeof QRCode.create>[1]);
  const modules = (qr as unknown as { modules: { size: number; data: Uint8Array } }).modules;
  const unit = CARD_LAYOUT.qr.size / (modules.size + 8);
  const qrX = CARD_LAYOUT.qr.x;
  const qrTop = CARD_LAYOUT.qr.y;
  page.drawRectangle({ x: qrX, y: y(qrTop + CARD_LAYOUT.qr.size), width: CARD_LAYOUT.qr.size, height: CARD_LAYOUT.qr.size, color: rgb(1, 1, 1) });
  for (let row = 0; row < modules.size; row++) for (let col = 0; col < modules.size; col++) {
    if (modules.data[row * modules.size + col]) {
      page.drawRectangle({ x: qrX + (col + 4) * unit, y: y(qrTop + (row + 5) * unit), width: unit, height: unit, color: black });
    }
  }
  text(student.id, 31, 105, 6.5, regular, gray);
  page.drawLine({ start: { x: 31, y: y(111) }, end: { x: PAGE_WIDTH - 31, y: y(111) }, thickness: 0.6, color: gray });
  text("Preencha uma bolinha por questão com caneta preta ou azul.", 31, 123, 7, regular, gray);

  const bubbles = bubblesFor(exam.questions);
  for (const bubble of bubbles) {
    if (bubble.answer === "A") text(String(bubble.question).padStart(2, "0"), bubble.x - 26, bubble.y + 2.2, 7, bold);
    page.drawCircle({ x: bubble.x, y: y(bubble.y), size: CARD_LAYOUT.bubbleRadius, borderColor: dark, borderWidth: 0.75 });
    text(bubble.answer, bubble.x + 6.3, bubble.y + 2.2, 6.6);
  }
  const footer = HALF_HEIGHT - 39;
  page.drawLine({ start: { x: 40, y: y(footer) }, end: { x: 249, y: y(footer) }, thickness: 0.5, color: gray });
  text("Assinatura do aluno", 31, footer + 11, 6.5, regular, gray);
  text("Identificação: QR do simulado e do aluno", 302, footer + 11, 6.3, regular, gray);
}

export async function makeCardsPdf(exam: Exam, roomName: string, students: CardStudent[]) {
  if (exam.questions > CARD_LAYOUT.maxQuestions) throw new Error("O cartão OMR aceita até 40 questões.");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (let index = 0; index < students.length; index += 2) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    card(page, 0, exam, roomName, students[index], regular, bold);
    if (students[index + 1]) card(page, 1, exam, roomName, students[index + 1], regular, bold);
    page.drawLine({ start: { x: 20, y: HALF_HEIGHT }, end: { x: PAGE_WIDTH - 20, y: HALF_HEIGHT }, thickness: 0.35, color: gray });
  }
  return pdf.save({ useObjectStreams: true });
}
