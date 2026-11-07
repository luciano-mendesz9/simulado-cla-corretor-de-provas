import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { ACCESS_COOKIE, publicUser, verifyAccess } from "./core";
import type { Role } from "@/generated/prisma/client";

export class ApiFailure extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function currentUser(token?: string) {
  if (!token) return null;
  try {
    const claims = await verifyAccess(token);
    const session = await getPrisma().session.findUnique({ where: { id: claims.sid }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.userId !== claims.sub ||
        session.user.status !== "ATIVO" || session.user.role !== claims.role) return null;
    return publicUser(session.user);
  } catch { return null; }
}
export async function authorize(request: NextRequest, roles: Role[] = ["COORDENACAO", "PROFESSOR"]) {
  const user = await currentUser(request.cookies.get(ACCESS_COOKIE)?.value);
  if (!user) throw new ApiFailure(401, "Sessão inválida ou expirada.");
  if (!roles.includes(user.role)) throw new ApiFailure(403, "Acesso não permitido.");
  return user;
}
export async function requirePage(roles: Role[]) {
  const user = await currentUser((await cookies()).get(ACCESS_COOKIE)?.value);
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(user.role === "PROFESSOR" ? "/professor" : "/coordenacao");
  return user;
}
export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (origin !== request.nextUrl.origin || (site && site !== "same-origin")) throw new ApiFailure(403, "Origem da requisição não permitida.");
}
export function safeError(error: unknown) {
  if (error instanceof ApiFailure) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  const code = (error as { code?: string })?.code;
  if (code === "P2002") return Response.json({ error: "Registro duplicado." }, { status: 409 });
  if (code === "P2003") return Response.json({ error: "Este registro possui vínculos e não pode ser excluído." }, { status: 409 });
  if (code === "P2025") return Response.json({ error: "Registro não encontrado." }, { status: 404 });
  return Response.json({ error: "Não foi possível concluir a operação." }, { status: 500, headers: { "Cache-Control": "no-store" } });
}
