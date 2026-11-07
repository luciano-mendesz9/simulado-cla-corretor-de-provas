import { getPrisma } from "@/lib/prisma";
import { ACCESS_SECONDS, REFRESH_COOKIE, ACCESS_COOKIE, SESSION_SECONDS, cookieOptions, signAccess, signRefresh, tokenHash, verifyRefresh } from "./core";
import { ApiFailure } from "./server";
import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@/generated/prisma/client";

export async function createSession(user: { id: string; role: Role }) {
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  const session = await getPrisma().session.create({ data: { userId: user.id, expiresAt, refreshHash: tokenHash(crypto.randomUUID()) } });
  const refresh = await signRefresh(user.id, user.role, session.id, expiresAt);
  await getPrisma().session.update({ where: { id: session.id }, data: { refreshHash: tokenHash(refresh) } });
  return { access: await signAccess(user.id, user.role, session.id), refresh, expiresAt };
}
export function setAuthCookies(response: NextResponse, tokens: { access: string; refresh: string; expiresAt: Date }) {
  response.cookies.set(ACCESS_COOKIE, tokens.access, cookieOptions(ACCESS_SECONDS));
  response.cookies.set(REFRESH_COOKIE, tokens.refresh, cookieOptions(Math.max(0, Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000))));
}
export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", cookieOptions(0));
  response.cookies.set(REFRESH_COOKIE, "", cookieOptions(0));
}
export async function rotateSession(request: NextRequest) {
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) throw new ApiFailure(401, "Sessão expirada.");
  let claims;
  try { claims = await verifyRefresh(refresh); } catch { throw new ApiFailure(401, "Sessão expirada."); }
  const session = await getPrisma().session.findUnique({ where: { id: claims.sid }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.userId !== claims.sub || session.user.status !== "ATIVO" || session.user.role !== claims.role) throw new ApiFailure(401, "Sessão inválida.");
  const oldHash = tokenHash(refresh);
  if (session.refreshHash !== oldHash) {
    // A short concurrent request window avoids revoking a legitimate parallel browser refresh.
    if (session.rotatedAt && Date.now() - session.rotatedAt.getTime() < 10_000) throw new ApiFailure(409, "Renovação simultânea. Tente novamente.");
    await getPrisma().session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() } });
    throw new ApiFailure(401, "Sessão revogada por reutilização de token.");
  }
  const nextRefresh = await signRefresh(session.userId, session.user.role, session.id, session.expiresAt);
  const updated = await getPrisma().session.updateMany({
    where: { id: session.id, refreshHash: oldHash, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { refreshHash: tokenHash(nextRefresh), rotatedAt: new Date() },
  });
  if (updated.count !== 1) throw new ApiFailure(409, "Renovação simultânea. Tente novamente.");
  return { access: await signAccess(session.userId, session.user.role, session.id), refresh: nextRefresh, expiresAt: session.expiresAt };
}
export async function revokeSession(request: NextRequest) {
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    try {
      const claims = await verifyRefresh(refresh);
      await getPrisma().session.updateMany({ where: { id: claims.sid, userId: claims.sub, revokedAt: null }, data: { revokedAt: new Date() } });
      return;
    } catch { /* Fall through to access token. */ }
  }
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  if (access) {
    try {
      const { verifyAccess } = await import("./core");
      const claims = await verifyAccess(access);
      await getPrisma().session.updateMany({ where: { id: claims.sid, userId: claims.sub, revokedAt: null }, data: { revokedAt: new Date() } });
    } catch { /* Invalid token: cookies are still cleared. */ }
  }
}
