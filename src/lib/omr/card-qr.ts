import { createHmac, timingSafeEqual } from "node:crypto";
import { CARD_LAYOUT } from "./layout";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function key() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("Segredo de assinatura do cartão não configurado.");
  return secret;
}
function signature(value: string) {
  return createHmac("sha256", key()).update("CLA-card-qr-v2\0").update(value).digest("base64url").slice(0, 22);
}
export function makeCardQr(examId: string, studentId: string) {
  if (!uuid.test(examId) || !uuid.test(studentId)) throw new Error("IDs do cartão inválidos.");
  const body = `CLA2|${CARD_LAYOUT.version}|${examId.toLowerCase()}|${studentId.toLowerCase()}`;
  return `${body}|${signature(body)}`;
}
export function parseCardQr(value: string) {
  const parts = value.split("|");
  if (parts.length !== 5 || parts[0] !== "CLA2" || parts[1] !== String(CARD_LAYOUT.version) || !uuid.test(parts[2]) || !uuid.test(parts[3])) return null;
  const body = parts.slice(0, 4).join("|");
  const expected = Buffer.from(signature(body));
  const actual = Buffer.from(parts[4]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { layoutVersion: CARD_LAYOUT.version, examId: parts[2].toLowerCase(), studentId: parts[3].toLowerCase() };
}
