import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import { CARD_LAYOUT } from "./layout";
import { parseCardQr } from "./card-qr";
import { classify, summarize, type Answer, type QuestionReading } from "./bubble-reader";

const answer = z.enum(["A", "B", "C", "D", "E"]);
const scores = z.strictObject({ A: z.number().min(0).max(1), B: z.number().min(0).max(1), C: z.number().min(0).max(1), D: z.number().min(0).max(1), E: z.number().min(0).max(1) });
const point = z.strictObject({ x: z.number().finite(), y: z.number().finite() });
const centers = z.strictObject({ A: point, B: point, C: point, D: point, E: point });
const question = z.strictObject({ number: z.number().int(), marked: z.array(answer).max(5), status: z.enum(["MARKED", "BLANK", "MULTIPLE", "UNCERTAIN"]), scores, fillRatios: scores, centers, needsReview: z.boolean(), confidence: z.number().min(0).max(1) });
const card = z.strictObject({ layoutVersion: z.literal(2), qrRaw: z.string().min(1).max(300), geometry: z.strictObject({ width: z.number().int().positive(), height: z.number().int().positive() }), questions: z.array(question).min(1).max(40), quality: z.strictObject({ markerError: z.number().int().min(0).max(2), markerSpan: z.number().positive(), scale: z.number().positive() }), previewJpegBase64: z.string().min(1).max(600_000) });
const success = z.strictObject({ version: z.literal(1), status: z.literal("SUCCESS"), cards: z.array(card).min(1).max(2) });
const failure = z.strictObject({ version: z.literal(1), status: z.literal("ERROR"), code: z.string().min(1).max(50), message: z.string().min(1).max(400) });

export class OmrFailure extends Error {
  constructor(public code: string, message: string, public httpStatus = 422) { super(message); }
}
export type RecognizedCard = {
  examId: string; studentId: string; layoutVersion: number; readings: QuestionReading[];
  summary: ReturnType<typeof summarize>; previewDataUrl: string; previewWidth: number;
  previewHeight: number; quality: z.infer<typeof card>["quality"]; imageHash: string;
};

function endpoint() {
  const raw = process.env.OMR_SERVICE_URL;
  if (!raw) throw new OmrFailure("OMR_UNAVAILABLE", "O serviço de leitura não está configurado.", 503);
  let url: URL;
  try { url = new URL(raw); } catch { throw new OmrFailure("OMR_UNAVAILABLE", "URL interna do serviço inválida.", 503); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new OmrFailure("OMR_UNAVAILABLE", "URL interna do serviço inválida.", 503);
  return new URL("analyze", url.href.endsWith("/") ? url : `${url.href}/`);
}

export async function recognizeCards(buffer: Buffer, answerKey: Record<number, Answer>, questions: number, expectedExamId: string): Promise<RecognizedCard[]> {
  if (!buffer.length || buffer.length > 3_700_000) throw new OmrFailure("FILE_TOO_LARGE", "A imagem está vazia ou excede 3,7 MB.");
  if (!Number.isInteger(questions) || questions < 1 || questions > CARD_LAYOUT.maxQuestions) throw new OmrFailure("BAD_QUESTIONS", "Quantidade de questões inválida.");
  const secret = process.env.OMR_SHARED_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new OmrFailure("OMR_UNAVAILABLE", "A autenticação do serviço de leitura não está configurada.", 503);
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHash("sha256").update(buffer).digest("hex");
  const signature = createHmac("sha256", secret).update(`v1:${timestamp}:${questions}:${digest}`).digest("hex");
  const type = buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? "image/jpeg" : buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png" : buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : null;
  if (!type) throw new OmrFailure("INVALID_FORMAT", "Use JPEG, PNG ou WebP.");
  let response: Response;
  try { response = await fetch(endpoint(), { method: "POST", headers: { "Content-Type": type, "X-OMR-Questions": String(questions), "X-OMR-Timestamp": String(timestamp), "X-OMR-Signature": signature }, body: new Uint8Array(buffer), signal: AbortSignal.timeout(25_000), cache: "no-store" }); }
  catch (error) { throw new OmrFailure("OMR_UNAVAILABLE", error instanceof Error && error.name === "TimeoutError" ? "O serviço de leitura excedeu 25 segundos." : "Não foi possível contactar o serviço de leitura.", 503); }
  if (Number(response.headers.get("content-length") || 0) > 1_600_000) throw new OmrFailure("OMR_BAD_RESPONSE", "Resposta do serviço de leitura acima do limite.", 502);
  let raw: unknown;
  try { raw = await response.json(); } catch { throw new OmrFailure("OMR_BAD_RESPONSE", "A URL do serviço de leitura não retornou JSON. Confira OMR_SERVICE_URL e se o FastAPI está iniciado.", 502); }
  const error = failure.safeParse(raw);
  if (error.success) throw new OmrFailure(error.data.code, error.data.message);
  if (!response.ok) throw new OmrFailure("OMR_UNAVAILABLE", "Serviço de leitura indisponível.", 503);
  const parsed = success.safeParse(raw);
  if (!parsed.success) throw new OmrFailure("OMR_BAD_RESPONSE", "Contrato do serviço de leitura incompatível.", 502);
  let wrongExam = false, badQr = false;
  const cards: RecognizedCard[] = [];
  for (const recognized of parsed.data.cards) {
    const identity = parseCardQr(recognized.qrRaw);
    if (!identity) { badQr = true; continue; }
    if (identity.examId !== expectedExamId) { wrongExam = true; continue; }
    if (recognized.questions.length !== questions || recognized.geometry.width !== Math.round(CARD_LAYOUT.width * CARD_LAYOUT.normalizationScale) || recognized.geometry.height !== Math.round(CARD_LAYOUT.height * CARD_LAYOUT.normalizationScale)) throw new OmrFailure("OMR_BAD_RESPONSE", "Geometria ou quantidade de questões incompatível.", 502);
    const readings = recognized.questions.map((item, index): QuestionReading => {
      if (item.number !== index + 1 || new Set(item.marked).size !== item.marked.length || item.needsReview !== (item.status === "UNCERTAIN") || (item.status === "MARKED" && item.marked.length !== 1) || (item.status === "BLANK" && item.marked.length !== 0) || (item.status === "MULTIPLE" && item.marked.length < 2) || (item.status === "UNCERTAIN" && item.marked.length)) throw new OmrFailure("OMR_BAD_RESPONSE", "Leitura inconsistente do serviço.", 502);
      const correct = answerKey[item.number];
      if (!correct) throw new OmrFailure("BAD_KEY", "Gabarito oficial incompleto.", 409);
      for (const p of Object.values(item.centers)) if (p.x < 0 || p.x > recognized.geometry.width || p.y < 0 || p.y > recognized.geometry.height) throw new OmrFailure("OMR_BAD_RESPONSE", "Coordenada inválida do serviço.", 502);
      return { question: item.number, selected: item.marked, correct, status: classify(item.marked, correct, item.status === "UNCERTAIN"), scores: item.scores, centers: item.centers, manual: false };
    });
    cards.push({ examId: identity.examId, studentId: identity.studentId, layoutVersion: identity.layoutVersion, readings, summary: summarize(readings), previewDataUrl: `data:image/jpeg;base64,${recognized.previewJpegBase64}`, previewWidth: recognized.geometry.width, previewHeight: recognized.geometry.height, quality: recognized.quality, imageHash: createHash("sha256").update(buffer).update(identity.studentId).digest("hex") });
  }
  if (badQr) throw new OmrFailure("INVALID_QR", "QR Code inválido ou adulterado.");
  if (wrongExam) throw new OmrFailure("WRONG_EXAM", "Este cartão pertence a outro simulado.");
  if (!cards.length) throw new OmrFailure("QR_UNREADABLE", "Nenhum QR Code válido foi identificado.");
  return cards;
}
