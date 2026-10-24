import {spawnSync} from "node:child_process";
import {readdirSync} from "node:fs";

// Run both suites as children of c8 so they share the same V8 coverage directory.
// This captures PostgreSQL integration paths as well as native Node unit tests.
for(const [command,args] of [
 ["node",["scripts/check-ci-db.mjs"]],
 ["node",["--conditions=react-server","scripts/check-financial-workers.mjs"]],
 ["node",["scripts/check-payout-workers.mjs"]],
 ["node",["scripts/check-withdrawal-worker.mjs"]],
 ["node",["scripts/check-authenticated-routes.mjs"]],
 ["node",["scripts/check-withdrawal-request-route.mjs"]],
 ["node",["scripts/check-deallocation-coordinator.mjs"]],
 ["node",["scripts/check-financial-cron-routes.mjs"]],
 ["node",["scripts/check-blockradar-reconciliation.mjs"]],
 ["node",["scripts/check-account-route-validation.mjs"]],
 ["node",["--experimental-strip-types","--test",...readdirSync("tests").filter(x=>x.endsWith(".test.ts")).sort().map(x=>"tests/"+x)]],
]){
 const result=spawnSync(command,args,{stdio:"inherit",env:process.env});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
