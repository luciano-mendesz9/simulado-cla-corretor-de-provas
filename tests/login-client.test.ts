import { test } from "node:test";
import assert from "node:assert/strict";
import { signIn } from "../src/lib/login-client";

const fakeFetch = (response: Response): typeof fetch => async () => response;
test("login shows the API's credential error", async () => {
  await assert.rejects(() => signIn("a@example.com", "bad", fakeFetch(Response.json({ error: "E-mail ou senha inválidos." }, { status: 401 }))), /E-mail ou senha inválidos/);
});
test("login reports an HTML response with its HTTP status", async () => {
  await assert.rejects(() => signIn("a@example.com", "bad", fakeFetch(new Response("<html>Not Found</html>", { status: 404, headers: { "Content-Type": "text/html" } }))), /HTTP 404 sem JSON/);
});
test("login distinguishes network failure from server response", async () => {
  const unavailable: typeof fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(() => signIn("a@example.com", "bad", unavailable), /Não foi possível acessar a API de login/);
});
test("successful login accepts only known internal destinations", async () => {
  assert.equal(await signIn("a@example.com", "password", fakeFetch(Response.json({ redirectTo: "/coordenacao" }))), "/coordenacao");
  await assert.rejects(() => signIn("a@example.com", "password", fakeFetch(Response.json({ redirectTo: "https://evil.example" }))), /destino esperado/);
});
