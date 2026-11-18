import test from "node:test";
import assert from "node:assert/strict";
import {calculateMonthlyBotStrategySplit,utcMonthWindow} from "../src/lib/bot-manager-monthly-accounting.ts";
const t=(id:string,gross:bigint,costs:[bigint,bigint,bigint],managerRate="30.0000",platformRate="20.0000")=>({
 id,grossMicros:gross,venueFeeMicros:costs[0],custodyFeeMicros:costs[1],operationalFeeMicros:costs[2],managerRate,platformRate
});
test("net accounting subtracts verified venue, custody and operating costs and replaces legacy fee",()=>{
 const a=calculateMonthlyBotStrategySplit([t("gain",10_000_000n,[1_000_000n,500_000n,500_000n])]);
 assert.deepEqual(a,{gross:10_000_000n,costs:2_000_000n,net:8_000_000n,manager:2_400_000n,platform:1_600_000n,investors:4_000_000n,tradeCount:1});
});
test("monthly losses offset monthly wins but never carry into the following month",()=>{
 const current=calculateMonthlyBotStrategySplit([t("gain",10_000_000n,[0n,0n,0n]),t("loss",-5_000_000n,[0n,0n,0n])]);
 assert.equal(current.net,5_000_000n);assert.equal(current.manager,1_500_000n);
 assert.equal(current.platform,1_000_000n);assert.equal(current.investors,2_500_000n);
 const next=calculateMonthlyBotStrategySplit([t("new",10_000_000n,[0n,0n,0n])]);
 assert.equal(next.manager,3_000_000n);
 const lost=calculateMonthlyBotStrategySplit([t("loss",-1_000_000n,[10n,0n,0n])]);
 assert.equal(lost.manager,0n);assert.equal(lost.platform,0n);assert.equal(lost.investors,-1_000_010n);
});
test("midmonth frozen percentages apply only to their weighted positive net contributions",()=>{
 const r=calculateMonthlyBotStrategySplit([
  t("early",6_000_000n,[0n,0n,0n],"30","20"),
  t("late",4_000_000n,[0n,0n,0n],"10","15"),
  t("loss",-2_000_000n,[0n,0n,0n],"30","20")
 ]);
 assert.equal(r.net,8_000_000n);assert.equal(r.manager,1_760_000n);
 assert.equal(r.platform,1_440_000n);assert.equal(r.investors,4_800_000n);
});
test("rejects malformed costs, duplicate events, and invalid percentage settings",()=>{
 assert.throws(()=>calculateMonthlyBotStrategySplit([t("x",100n,[-1n,0n,0n])]),/Negative/);
 assert.throws(()=>calculateMonthlyBotStrategySplit([t("x",100n,[0n,0n,0n]),t("x",0n,[0n,0n,0n])]),/Duplicate/);
 assert.throws(()=>calculateMonthlyBotStrategySplit([t("x",100n,[0n,0n,0n],"80","40")]),/exceed/);
 assert.throws(()=>calculateMonthlyBotStrategySplit([t("x",100n,[0n,0n,0n],"100.0001","0")]),/exceeds/);
 assert.deepEqual(calculateMonthlyBotStrategySplit([]),{gross:0n,costs:0n,net:0n,manager:0n,platform:0n,investors:0n,tradeCount:0});
});
test("uses exclusive UTC month boundaries, including December rollover",()=>{
 assert.deepEqual(utcMonthWindow("2026-12"),{start:new Date("2026-12-01T00:00:00.000Z"),end:new Date("2027-01-01T00:00:00.000Z")});
 for(const invalid of ["2026-13","2026-00","foo","2019-12","2027-1"])assert.throws(()=>utcMonthWindow(invalid));
});
