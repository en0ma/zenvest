import type { Instrumentation } from "next";

// Next.js reports uncaught server request errors here. Do not emit the
// original error message/stack: they can contain PII or request details.
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const segment = request.path.split("/").filter(Boolean)[0] ?? "home";
  const area = ["api", "wallet", "dashboard", "transactions", "bot", "settings", "admin", "login", "register"].includes(segment) ? segment : "other";
  console.error(JSON.stringify({
    component: "request-error",
    area,
    method: request.method,
    routerKind: context.routerKind,
    routeType: context.routeType,
    errorType: error instanceof Error ? error.name : "unknown",
  }));
};
