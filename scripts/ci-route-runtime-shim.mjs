// Test-only replacements for Next framework boundary dependencies.
// Route business logic and Prisma remain the real production implementations.
export const NextResponse={json:(body,init={})=>Response.json(body,init)};
export const requireUser=async()=>({id:"ci_route_investor",role:"USER"});
