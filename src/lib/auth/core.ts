import { createHash, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { Role } from "@/generated/prisma/client";

export const ACCESS_COOKIE = "cla_access";
export const REFRESH_COOKIE = "cla_refresh";
export const ACCESS_SECONDS = 15 * 60;
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
const issuer = "simulado-cla";

function secret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET") {
  const value = process.env[name];
  if (!value || Buffer.byteLength(value) < 32) throw new Error(`${name} deve ter pelo menos 32 bytes`);
  return new TextEncoder().encode(value);
}
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export type TokenClaims = JWTPayload & { sub: string; sid: string; role: Role };

export async function signAccess(userId: string, role: Role, sessionId: string) {
  return new SignJWT({ role, sid: sessionId }).setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer).setAudience("access").setSubject(userId).setIssuedAt()
    .setExpirationTime(`${ACCESS_SECONDS}s`).sign(secret("JWT_ACCESS_SECRET"));
}
export async function signRefresh(userId: string, role: Role, sessionId: string, expiresAt: Date) {
  return new SignJWT({ role, sid: sessionId }).setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer).setAudience("refresh").setSubject(userId).setJti(randomUUID()).setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000)).sign(secret("JWT_REFRESH_SECRET"));
}
async function verify(token: string, name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET", audience: string): Promise<TokenClaims> {
  const { payload } = await jwtVerify(token, secret(name), { issuer, audience, algorithms: ["HS256"] });
  if (typeof payload.sub !== "string" || typeof payload.sid !== "string" ||
      (payload.role !== "COORDENACAO" && payload.role !== "PROFESSOR")) throw new Error("Token inválido");
  return payload as TokenClaims;
}
export const verifyAccess = (token: string) => verify(token, "JWT_ACCESS_SECRET", "access");
export const verifyRefresh = (token: string) => verify(token, "JWT_REFRESH_SECRET", "refresh");
export function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge };
}
export function publicUser(user: { id: string; firstName: string; lastName: string; email: string; role: Role; status: string }) {
  return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, status: user.status };
}
export function homeFor(role: Role) { return role === "COORDENACAO" ? "/coordenacao" : "/professor"; }
