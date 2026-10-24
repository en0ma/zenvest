// Test-only replacements for Next framework boundary dependencies.
// Route business logic and Prisma remain the real production implementations.
export const NextResponse={json:(body,init={})=>{
 const response=Response.json(body,init);
 response.cookies={set:(name,value,options={})=>{
  const parts=[encodeURIComponent(name)+"="+encodeURIComponent(value)];
  if(options.path)parts.push("Path="+options.path);
  if(options.maxAge!==undefined)parts.push("Max-Age="+options.maxAge);
  if(options.httpOnly)parts.push("HttpOnly");
  if(options.secure)parts.push("Secure");
  if(options.sameSite)parts.push("SameSite="+options.sameSite);
  response.headers.append("Set-Cookie",parts.join("; "));
 }};
 return response;
}};
export const requireUser=async()=>({id:"ci_route_investor",role:"USER"});
