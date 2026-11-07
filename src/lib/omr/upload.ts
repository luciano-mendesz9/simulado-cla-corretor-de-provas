import type { NextRequest } from "next/server";
import { ApiFailure } from "@/lib/auth/server";

export async function boundedFormData(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiFailure(400, "Imagem não enviada.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 4_200_000) { await reader.cancel(); throw new ApiFailure(413, "A requisição excede o limite de 4,2 MB."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return await new Request(request.url, { method: "POST", headers: { "content-type": request.headers.get("content-type") || "" }, body: bytes }).formData(); }
  catch { throw new ApiFailure(400, "Arquivo inválido."); }
}
