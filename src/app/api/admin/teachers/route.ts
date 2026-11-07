import { NextRequest } from "next/server";
import { hash, argon2id } from "argon2";
import { getPrisma } from "@/lib/prisma";
import { teacherCreateInput } from "@/lib/auth/validators";
import { authorize, safeError } from "@/lib/auth/server";
import { mutation, noStore, parseBody } from "@/lib/api";
import { publicUser } from "@/lib/auth/core";
export async function GET(request: NextRequest) {
  try {
    await authorize(request, ["COORDENACAO"]);
    const users = await getPrisma().user.findMany({ where: { role: "PROFESSOR" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] });
    return Response.json({ teachers: users.map(publicUser) }, { headers: noStore });
  } catch (error) { return safeError(error); }
}
export async function POST(request: NextRequest) {
  return mutation(request, async () => {
    await authorize(request, ["COORDENACAO"]);
    const { password, ...body } = await parseBody(request, teacherCreateInput);
    const user = await getPrisma().user.create({ data: { ...body, passwordHash: await hash(password, { type: argon2id }), role: "PROFESSOR" } });
    return Response.json({ teacher: publicUser(user) }, { status: 201, headers: noStore });
  });
}
