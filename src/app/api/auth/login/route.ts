import { NextResponse, type NextRequest } from "next/server";
import { verify as verifyPassword } from "argon2";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { parseBody } from "@/lib/api";
import { ApiFailure, safeError } from "@/lib/auth/server";
import { createSession, setAuthCookies } from "@/lib/auth/session";
import { homeFor, publicUser } from "@/lib/auth/core";

const input = z.strictObject({ email: z.email().max(160), password: z.string().min(1).max(256) });
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request, input);
    const email = body.email.trim().toLowerCase();
    const key = createHash("sha256").update(email).digest("hex");
    const now = new Date();
    await getPrisma().loginThrottle.updateMany({ where: { key, windowStart: { lt: new Date(now.getTime() - 15 * 60_000) } }, data: { attempts: 0, windowStart: now } });
    const throttle = await getPrisma().loginThrottle.upsert({ where: { key }, create: { key, attempts: 1, windowStart: now }, update: { attempts: { increment: 1 } } });
    if (throttle.attempts > 8) throw new ApiFailure(429, "Muitas tentativas. Aguarde 15 minutos.");
    const user = await getPrisma().user.findUnique({ where: { email } });
    const valid = user ? await verifyPassword(user.passwordHash, body.password) : false;
    if (!valid) throw new ApiFailure(401, "E-mail ou senha inválidos.");
    if (user!.status !== "ATIVO") throw new ApiFailure(403, "Conta inativa. Procure a coordenação.");
    const tokens = await createSession(user!);
    await getPrisma().loginThrottle.deleteMany({ where: { key } });
    const response = NextResponse.json({ user: publicUser(user!), redirectTo: homeFor(user!.role) }, { headers: { "Cache-Control": "no-store" } });
    setAuthCookies(response, tokens);
    return response;
  } catch (error) { return safeError(error); }
}
