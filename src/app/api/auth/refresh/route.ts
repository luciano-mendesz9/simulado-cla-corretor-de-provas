import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin, safeError } from "@/lib/auth/server";
import { rotateSession, setAuthCookies } from "@/lib/auth/session";
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const tokens = await rotateSession(request);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    setAuthCookies(response, tokens);
    return response;
  } catch (error) { return safeError(error); }
}
