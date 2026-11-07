import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { assertSameOrigin, ApiFailure } from "../src/lib/auth/server";
import { GET as classroomsGet, POST as classroomsPost } from "../src/app/api/admin/classrooms/route";
import { GET as studentsGet } from "../src/app/api/admin/students/route";
import { GET as teachersGet } from "../src/app/api/admin/teachers/route";

test("administrative list endpoints reject anonymous requests before querying the database", async () => {
  for (const handler of [classroomsGet, studentsGet, teachersGet]) {
    const response = await handler(new NextRequest("http://localhost:3000/api/admin/test"));
    assert.equal(response.status, 401);
  }
});
test("administrative writes reject cross-site Origin", async () => {
  const request = new NextRequest("http://localhost:3000/api/admin/classrooms", {
    method: "POST", headers: { origin: "https://other.example", "content-type": "application/json" }, body: JSON.stringify({ name: "Teste" }),
  });
  const response = await classroomsPost(request);
  assert.equal(response.status, 403);
});
test("same-site Origin and Fetch Metadata are required together", () => {
  const good = new NextRequest("http://localhost:3000/api/test", { method: "POST", headers: { origin: "http://localhost:3000", "sec-fetch-site": "same-origin" } });
  assert.doesNotThrow(() => assertSameOrigin(good));
  const bad = new NextRequest("http://localhost:3000/api/test", { method: "POST", headers: { origin: "http://localhost:3000", "sec-fetch-site": "cross-site" } });
  assert.throws(() => assertSameOrigin(bad), (error: unknown) => error instanceof ApiFailure && error.status === 403);
});
