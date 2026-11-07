import { NextRequest } from "next/server";
import { authorize, safeError } from "@/lib/auth/server";
import { noStore } from "@/lib/api";
export async function GET(request: NextRequest) {
  try { return Response.json({ user: await authorize(request) }, { headers: noStore }); }
  catch (error) { return safeError(error); }
}
