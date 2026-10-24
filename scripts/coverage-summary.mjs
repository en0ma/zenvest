import {existsSync,readFileSync,appendFileSync} from "node:fs";

const path="coverage/coverage-summary.json";
if(!existsSync(path)){
 console.error("Coverage summary not found: coverage gate cannot pass.");
 process.exit(1);
}
const coverage=JSON.parse(readFileSync(path,"utf8"));
const metrics=["lines","branches","functions","statements"];
const percent=(v)=>v?Number(v.pct).toFixed(2)+"%":"N/A";
const rows=Object.entries(coverage).filter(([name])=>name!=="total")
 .map(([name,values])=>({name,lines:values.lines?.pct??0,branches:values.branches?.pct??0,
  functions:values.functions?.pct??0}))
 .sort((a,b)=>a.branches-b.branches||a.lines-b.lines).slice(0,12);
let report="## Zenvest code coverage\n\n";
report+="Includes the PostgreSQL integration script and native Node unit tests. Minimum line coverage: 85%.\n\n";
report+="| Metric | Coverage |\n|---|---:|\n";
for(const metric of metrics)report+=`| ${metric} | ${percent(coverage.total?.[metric])} |\n`;
report+="\n### Lowest branch coverage (sample)\n\n| Source | Branches | Lines |\n|---|---:|---:|\n";
for(const row of rows)report+=`| ${row.name.replaceAll("|","\\|")} | ${row.branches.toFixed(2)}% | ${row.lines.toFixed(2)}% |\n`;
report+="\nDownload the `zenvest-coverage` CI artifact for the LCOV and machine-readable summary.\n";
console.log(report);
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,report);
const minimum=85;
const actual=coverage.total?.lines?.pct;
if(!Number.isFinite(actual)||actual<minimum){
 console.error(`Coverage gate failed: expected at least ${minimum}% lines, got ${actual??"missing"}`);
 process.exitCode=1;
}
