import { NextResponse, type NextRequest } from "next/server";
import { rotateSession, setAuthCookies, clearAuthCookies } from "@/lib/auth/session";
export async function GET(request: NextRequest) {
  const destination = request.nextUrl.searchParams.get("returnTo") || "/";
  const safePath = destination.startsWith("/") && !destination.startsWith("//") && !destination.startsWith("/api/") ? destination : "/";
  const target = new URL(safePath, request.url);
  if (target.origin !== request.nextUrl.origin) return new Response("Forbidden", { status: 403 });
  if (request.headers.get("sec-fetch-site") === "cross-site") return new Response("Forbidden", { status: 403 });
  try {
    const tokens = await rotateSession(request);
    const response = NextResponse.redirect(target);
    response.headers.set("Cache-Control", "no-store");
    setAuthCookies(response, tokens);
    return response;
  } catch (error) {
    if ((error as { status?: number }).status === 409) return new Response("Renovação simultânea. Atualize a página em instantes.", { status: 409, headers: { "Cache-Control": "no-store", "Retry-After": "1" } });
    const response = NextResponse.redirect(new URL("/login", request.url));
    clearAuthCookies(response);
    return response;
  }
}
