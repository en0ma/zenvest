export function staffWriteError(error:unknown):Response {
 if(error instanceof Error&&error.message==="STAFF_FRESH_LOGIN_REQUIRED")
  return Response.json({error:"Sign in again with two-factor authentication to perform this sensitive action.",code:"STAFF_REAUTH_REQUIRED"},{status:401,headers:{"Cache-Control":"no-store"}});
 return Response.json({error:"Access denied or action unavailable"},{status:403,headers:{"Cache-Control":"no-store"}});
}
