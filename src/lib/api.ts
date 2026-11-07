import { z } from "zod";
import type { NextRequest } from "next/server";
import { ApiFailure, assertSameOrigin, safeError } from "@/lib/auth/server";

export async function parseBody<T extends z.ZodType>(request: NextRequest, schema: T): Promise<z.output<T>> {
  assertSameOrigin(request);
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiFailure(415, "Envie JSON.");
  let body: unknown;
  try { body = await request.json(); } catch { throw new ApiFailure(400, "JSON inválido."); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiFailure(400, parsed.error.issues[0]?.message || "Dados inválidos.");
  return parsed.data;
}
export async function mutation(request: NextRequest, work: () => Promise<Response>) {
  try { assertSameOrigin(request); return await work(); } catch (error) { return safeError(error); }
}
export const noStore = { "Cache-Control": "no-store" };
