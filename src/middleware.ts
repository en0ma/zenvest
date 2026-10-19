import { NextResponse, type NextRequest } from "next/server";

// One safe access event per application request. Never log query strings,
// request bodies, cookies, authorization headers, or investor identifiers.
export function middleware(request: NextRequest) {
  const segment = request.nextUrl.pathname.split("/").filter(Boolean)[0] ?? "home";
  const area = ["api", "wallet", "dashboard", "transactions", "bot", "settings", "admin", "login", "register", "withdrawals", "deposits"].includes(segment) ? segment : "other";
  const path=request.nextUrl.pathname;
  // Match static routes only; do not log arbitrary path segments or query strings.
  const route=[
    "/api/webhooks/blockradar","/api/wallet/activate",
    "/api/internal/reconcile-blockradar","/api/auth",
    "/wallet","/dashboard","/login","/register",
  ].find(prefix=>path===prefix||path.startsWith(prefix+"/"))??area;
  console.info(JSON.stringify({
    component: "http-access",
    requestId: request.headers.get("x-vercel-id") ?? crypto.randomUUID(),
    method: request.method,
    area,
    route,
  }));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|webp|svg|ico|css|js|woff2?)$).*)"],
};
