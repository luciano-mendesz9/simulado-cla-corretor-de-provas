import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin, safeError } from "@/lib/auth/server";
import { clearAuthCookies, revokeSession } from "@/lib/auth/session";
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await revokeSession(request);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    clearAuthCookies(response);
    return response;
  } catch (error) { return safeError(error); }
}
