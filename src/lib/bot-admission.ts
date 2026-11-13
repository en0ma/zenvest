/** Admission evidence is simulated, not verified real-money performance.
 * The admin can override only these sandbox thresholds, not custody checks. */
export function evaluateSandboxAdmission(input:{
 createdAt:Date|undefined;fills:number;settlements:number;realizedPnlMicros:bigint;
 drawdownBps:number;minDays:number|null;minFills:number|null;maxDrawdownPct:number|null;now?:Date;
}):string[]{
 const reasons:string[]=[];
 if(input.minDays===null||input.minFills===null||input.maxDrawdownPct===null)
  return ["ADMISSION_POLICY_UNCONFIGURED"];
 if(!input.createdAt)return ["NO_SANDBOX_HISTORY"];
 const days=((input.now??new Date()).getTime()-input.createdAt.getTime())/86400000;
 if(days<input.minDays)reasons.push("INSUFFICIENT_SANDBOX_DAYS");
 if(input.fills<input.minFills)reasons.push("INSUFFICIENT_SANDBOX_FILLS");
 if(input.settlements<1)reasons.push("NO_SETTLED_SANDBOX_EVENTS");
 if(input.drawdownBps>input.maxDrawdownPct*100)reasons.push("EXCESSIVE_SANDBOX_DRAWDOWN");
 if(input.realizedPnlMicros<=0n)reasons.push("NO_POSITIVE_REALIZED_SANDBOX_PNL");
 return reasons;
}
