import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE, cookieOptions, signAccess, signRefresh, tokenHash, verifyAccess, verifyRefresh } from "../src/lib/auth/core";
import { proxy } from "../src/proxy";
import { classroomInput, studentInput, teacherCreateInput, teacherUpdateInput } from "../src/lib/auth/validators";

process.env.JWT_ACCESS_SECRET = "test-access-secret-0123456789-0123456789";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-0123456789-0123456789";
const userId = "b07c8a84-0a68-4a3f-9d9a-f24854afba43";
const sid = "235e5a6b-226e-47ef-9eef-5eaf5d298d75";

test("access JWT validates signature, audience, expiry and role", async () => {
  const token = await signAccess(userId, "PROFESSOR", sid);
  const claims = await verifyAccess(token);
  assert.equal(claims.sub, userId); assert.equal(claims.sid, sid); assert.equal(claims.role, "PROFESSOR");
  await assert.rejects(() => verifyRefresh(token));
  await assert.rejects(() => verifyAccess(token.slice(0, -3) + "abc"));
  const expired = await new SignJWT({ role: "PROFESSOR", sid }).setProtectedHeader({ alg: "HS256" }).setIssuer("simulado-cla").setAudience("access").setSubject(userId).setIssuedAt(1).setExpirationTime(2).sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET));
  await assert.rejects(() => verifyAccess(expired));
});
test("refresh token is distinct and bound to fixed session expiry", async () => {
  const expiry = new Date(Date.now() + 60_000);
  const token = await signRefresh(userId, "COORDENACAO", sid, expiry);
  const claims = await verifyRefresh(token);
  assert.equal(claims.exp, Math.floor(expiry.getTime() / 1000));
  assert.equal(tokenHash(token).length, 64);
  assert.notEqual(tokenHash(token), token);
  await assert.rejects(() => verifyAccess(token));
});
test("cookies stay HTTP-only and secure in production", () => {
  const old = process.env.NODE_ENV; Object.assign(process.env, { NODE_ENV: "production" });
  const options = cookieOptions(60);
  assert.equal(options.httpOnly, true); assert.equal(options.secure, true); assert.equal(options.sameSite, "strict");
  Object.assign(process.env, { NODE_ENV: old });
});
test("proxy redirects anonymous and blocks professor from coordination", async () => {
  const anonymous = await proxy(new NextRequest("http://localhost:3000/coordenacao"));
  assert.equal(new URL(anonymous.headers.get("location")!).pathname, "/login");
  const token = await signAccess(userId, "PROFESSOR", sid);
  const req = new NextRequest("http://localhost:3000/coordenacao/turmas", { headers: { cookie: `${ACCESS_COOKIE}=${token}` } });
  const denied = await proxy(req);
  assert.equal(new URL(denied.headers.get("location")!).pathname, "/professor");
});
test("CRUD inputs reject arbitrary roles, password changes and bad links", () => {
  assert.equal(classroomInput.safeParse({ name: " 3º Ano A " }).success, true);
  assert.equal(classroomInput.safeParse({ name: "A", year: 2026 }).success, false);
  assert.equal(studentInput.safeParse({ firstName: "A", lastName: "B", classroomId: "bad" }).success, false);
  assert.equal(teacherCreateInput.safeParse({ firstName: "A", lastName: "B", email: "a@example.com", password: "verysecurepass", status: "ATIVO", role: "COORDENACAO" }).success, false);
  assert.equal(teacherUpdateInput.safeParse({ firstName: "A", lastName: "B", email: "a@example.com", status: "ATIVO", password: "newpassword123" }).success, false);
});
