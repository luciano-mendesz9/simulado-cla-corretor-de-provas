import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, verifyAccess } from "@/lib/auth/core";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  let claims: Awaited<ReturnType<typeof verifyAccess>> | null = null;
  if (access) { try { claims = await verifyAccess(access); } catch { /* Refresh below. */ } }
  if (path === "/login") {
    if (!claims && request.cookies.has(REFRESH_COOKIE)) {
      const renew = new URL("/api/auth/renew", request.url);
      renew.searchParams.set("returnTo", "/login");
      return NextResponse.redirect(renew);
    }
    return NextResponse.next();
  }
  if (claims) {
    if (path.startsWith("/coordenacao") && claims.role !== "COORDENACAO") return NextResponse.redirect(new URL("/professor", request.url));
    return NextResponse.next();
  }
  if (request.cookies.has(REFRESH_COOKIE)) {
    const renew = new URL("/api/auth/renew", request.url);
    renew.searchParams.set("returnTo", path + request.nextUrl.search);
    return NextResponse.redirect(renew);
  }
  return NextResponse.redirect(new URL("/login", request.url));
}
export const config = { matcher: ["/login", "/coordenacao/:path*", "/professor/:path*", "/cartoes/:path*"] };
