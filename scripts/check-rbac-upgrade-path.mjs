// Test an in-place RBAC upgrade against real disposable PostgreSQL, never production.
import {spawnSync} from "node:child_process";
import {mkdtempSync,readdirSync,renameSync,rmdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
if(!process.env.DATABASE_URL?.includes("zenvest_ci")||process.env.NODE_ENV!=="test")
 throw Error("RBAC upgrade fixture may run only on disposable zenvest_ci test DB");
const root="prisma/migrations";
const held=mkdtempSync(join(tmpdir(),"zenvest-rbac-upgrade-"));
const cutover="20261104120000_baseline_user_role";
const moved=[];
function run(command,args){
 const result=spawnSync(command,args,{stdio:"inherit",env:process.env});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error(command+" "+args.join(" ")+" failed ("+result.status+")");
}
try{
 for(const dir of readdirSync(root).filter(x=>x>=cutover&&/^\d{14}_/.test(x)).sort()){
  renameSync(join(root,dir),join(held,dir));moved.push(dir);
 }
 if(!moved.includes(cutover)||!moved.includes("20261104124500_unified_rbac_table_cutover"))
  throw Error("Expected unified RBAC migration stages were not found");
 run("npx",["prisma","migrate","deploy"]);
 run("node",["scripts/check-rbac-upgrade-fixture.mjs","seed"]);
 // The preflight must accept intact legacy grants and fail closed when a
 // preexisting baseline user role carries a privileged grant.
 run("node",["scripts/check-rbac-preflight.mjs"]);
 run("node",["scripts/check-rbac-upgrade-fixture.mjs","unsafe-seed"]);
 const denied=spawnSync("node",["scripts/check-rbac-preflight.mjs"],{stdio:"inherit",env:process.env});
 if(denied.error)throw denied.error;
 if(denied.status===0)throw Error("Preflight accepted an unauthorized baseline staff grant");
 run("node",["scripts/check-rbac-upgrade-fixture.mjs","unsafe-clear"]);
 run("node",["scripts/check-rbac-preflight.mjs"]);
}finally{
 for(const dir of moved)renameSync(join(held,dir),join(root,dir));
 rmdirSync(held);
}
run("npx",["prisma","migrate","deploy"]);
run("node",["scripts/check-rbac-upgrade-fixture.mjs","verify"]);
