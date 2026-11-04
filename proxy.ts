import {
  publicOrigin,
  permittedPublicRequest,
} from "./server/security/public-origin.ts";
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (!["GET", "HEAD"].includes(request.method))
    return NextResponse.json(
      { error: "Use the API for mutations." },
      {
        status: 405,
        headers: { Allow: "GET, HEAD", "cache-control": "no-store" },
      },
    );
  const origin = publicOrigin();
  if (
    !permittedPublicRequest(request.headers, request.nextUrl.pathname, origin)
  )
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  const nonce = btoa(crypto.randomUUID());
  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self' https://dnd5e.lamagra.link",
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  if (origin)
    response.headers.set("Strict-Transport-Security", "max-age=15552000");
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|favicon.svg).*)",
    },
  ],
};
