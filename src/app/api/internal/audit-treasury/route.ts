import {authorizedCron} from "@/lib/cron-auth";
import {runTreasuryAudit} from "@/lib/treasury-audit";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Scheduled read-only audit. All findings are returned to the authorized caller
 * and emitted as safe structured logs for operations alert routing. */
export async function GET(request:Request){
 if(!authorizedCron(request))return Response.json({error:"Unauthorized"},{status:401,
  headers:{"Cache-Control":"no-store"}});
 try{
  const report=await runTreasuryAudit();
  for(const issue of report.findings){
   const entry={component:"treasury-audit",severity:issue.severity,
    code:issue.code,count:issue.count,checkedAt:report.checkedAt};
   if(issue.severity==="critical")console.error(JSON.stringify(entry));
   else console.warn(JSON.stringify(entry));
  }
  console.info(JSON.stringify({component:"treasury-audit",outcome:"completed",
   checkedAt:report.checkedAt,complete:report.complete,criticalCount:report.criticalCount,
   warningCount:report.warningCount,custodyStatus:report.custody.status}));
  // A critical finding must be surfaced as a failed check to external monitors.
  // Missing custody evidence also means the verification was incomplete.
  return Response.json(report,{status:report.criticalCount||!report.complete?503:200,
   headers:{"Cache-Control":"no-store"}});
 }catch(error){
  console.error(JSON.stringify({component:"treasury-audit",outcome:"failed",
   errorType:error instanceof Error?error.name:"unknown"}));
  return Response.json({error:"Treasury audit could not complete"},{status:503,
   headers:{"Cache-Control":"no-store"}});
 }
}
