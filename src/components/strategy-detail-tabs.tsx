"use client";
import {useMemo,useRef,useState} from "react";

type Point={time:string;pnl:number};
type Candle={start:number;end:number;open:number;high:number;low:number;close:number;change:number;count:number;lastTime:number};
const ranges=[["1 Day",86400000],["7 Days",7*86400000],["30 Days",30*86400000],["All Time",Infinity]] as const;
const money=(n:number)=>`${n>0?"+":n<0?"−":""}${Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const formatDate=(time:number,withTime:boolean)=>new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",...(withTime?{hour:"numeric",minute:"2-digit"}:{})}).format(time);

export function StrategyDetailTabs({points,description,note,stats}:{points:Point[];description:string;note:string|null;stats:{market:string;status:string;total:string;settlements:number;capacity:string}}){
 const [tab,setTab]=useState<"price"|"info">("price");
 const [range,setRange]=useState<(typeof ranges)[number][0]>("All Time");
 const [selected,setSelected]=useState<number|null>(null);
 const plotRef=useRef<SVGSVGElement>(null);
 const period=ranges.find(x=>x[0]===range)?.[1]??Infinity;
 const {candles,total}=useMemo(()=>{
  const now=Date.now(),cutoff=period===Infinity?-Infinity:now-period;
  const records=points.map(p=>({time:Date.parse(p.time),pnl:p.pnl})).filter(p=>Number.isFinite(p.time)&&Number.isFinite(p.pnl)&&p.time<=now).sort((a,b)=>a.time-b.time);
  const filtered=records.filter(p=>p.time>=cutoff);
  const result:Candle[]=[];
  if(!filtered.length)return {candles:result,total:0};
  const first=filtered[0].time;
  const bucketMs=range==="1 Day"?3600000:range==="7 Days"?6*3600000:range==="30 Days"?86400000:Math.max(86400000,Math.ceil((now-first)/40/86400000)*86400000);
  let running=0;
  for(const record of filtered){
   const start=Math.floor(record.time/bucketMs)*bucketMs;
   let candle=result[result.length-1];
   if(!candle||candle.start!==start){
    candle={start,end:start+bucketMs,open:running,high:running,low:running,close:running,change:0,count:0,lastTime:record.time};
    result.push(candle);
   }
   running+=record.pnl;
   candle.close=running;candle.high=Math.max(candle.high,running);candle.low=Math.min(candle.low,running);candle.change+=record.pnl;candle.count++;candle.lastTime=record.time;
  }
  return {candles:result,total:running};
 },[points,period,range]);
 const selectedCandle=selected===null?null:candles[selected]??null;
 const width=340,left=12,right=300,top=14,bottom=176;
 const allValues=[0,...candles.flatMap(c=>[c.high,c.low])];
 const min=Math.min(...allValues),max=Math.max(...allValues);
 const span=max-min||1,pad=span*.12;
 const y=(v:number)=>bottom-(v-(min-pad))/(span+2*pad)*(bottom-top);
 const x=(i:number)=>left+(i+.5)*(right-left)/candles.length;
 const candleWidth=candles.length?Math.max(2,Math.min(11,(right-left)/candles.length*.62)):6;
 const choose=(clientX:number)=>{
  const rect=plotRef.current?.getBoundingClientRect();
  if(!rect||!candles.length)return;
  const px=(clientX-rect.left)*width/rect.width;
  const idx=Math.round((px-left)/(right-left)*candles.length-.5);
  setSelected(Math.max(0,Math.min(candles.length-1,idx)));
 };
 const dateIncludesTime=range==="1 Day"||range==="7 Days";
 return <section className="overflow-hidden rounded-2xl border border-[#E3E8EE] bg-white text-[#14253D]">
  <nav className="flex gap-7 border-b border-[#E5EAF0] px-4 sm:px-6" aria-label="Strategy details">
   {(["price","info"] as const).map(t=><button key={t} type="button" aria-selected={tab===t} onClick={()=>setTab(t)} className={"border-b-2 py-3 text-sm font-semibold "+(tab===t?"border-[#635BFF] text-[#635BFF]":"border-transparent text-[#64748B]")}>{t==="price"?"Performance":"About"}</button>)}
  </nav>
  {tab==="price"?<div className="space-y-4 p-4 sm:p-6">
   <div><p className="text-xs text-[#64748B]">Total profit or loss</p><p className={"mt-1 text-2xl font-semibold tabular-nums "+(total<0?"text-rose-600":"text-[#14253D]")}>{money(total)} <span className="text-sm font-normal text-[#64748B]">USDC</span></p><p className="mt-1 flex items-center gap-1 text-xs text-[#059669]"><span aria-hidden="true">✓</span> Confirmed results</p></div>
   <div className="flex gap-2" role="group" aria-label="Performance period">{ranges.map(([label])=><button type="button" key={label} onClick={()=>{setRange(label);setSelected(null)}} aria-pressed={range===label} className={"min-w-0 flex-1 rounded-lg px-2 py-2 text-xs font-medium "+(range===label?"bg-[#EEECFF] text-[#635BFF]":"bg-[#F8FAFC] text-[#64748B]")}>{label}</button>)}</div>
   <div className="rounded-xl bg-[#F8FAFC] p-2 sm:p-3">
    <svg ref={plotRef} viewBox="0 0 340 218" className="w-full select-none touch-pan-y" role="img" aria-label="Interactive chart of profit or loss from completed trades; touch or drag to inspect dates" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);choose(e.clientX)}} onPointerMove={e=>{if(e.pointerType==="mouse"||e.buttons)choose(e.clientX)}} onKeyDown={e=>{if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();setSelected(v=>Math.max(0,Math.min(candles.length-1,(v??candles.length-1)+(e.key==="ArrowRight"?1:-1))))}}} tabIndex={candles.length?0:-1}>
     {[30,76,122,168].map(v=><line key={v} x1={left} x2={right} y1={v} y2={v} stroke="#E4E9F0" strokeWidth="1"/>)}
     {candles.length>0&&[0,.5,1].map((part,i)=><text key={i} x="338" y={y(min+(max-min)*part)+3} fill="#94A3B8" fontSize="9" textAnchor="end">{(min+(max-min)*part).toLocaleString("en-US",{maximumFractionDigits:0})}</text>)}
     {candles.map((c,i)=>{const col=c.change>=0?"#059669":"#E11D48";return <g key={c.start}><line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={col} strokeWidth="1.2"/><rect x={x(i)-candleWidth/2} y={Math.min(y(c.open),y(c.close))} width={candleWidth} height={Math.max(1.5,Math.abs(y(c.open)-y(c.close)))} rx=".6" fill={col}/></g>})}
     {selectedCandle&&<><line x1={x(selected!)} x2={x(selected!)} y1={top} y2={bottom} stroke="#94A3B8" strokeDasharray="4 4"/><circle cx={x(selected!)} cy={y(selectedCandle.close)} r="3.5" fill="#FFFFFF" stroke="#635BFF" strokeWidth="1.8"/></>}
     {candles.length>0&&[0,Math.floor((candles.length-1)/2),candles.length-1].map((i,k)=><text key={k} x={x(i)} y="204" textAnchor={k===0?"start":k===2?"end":"middle"} fill="#94A3B8" fontSize="10">{new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",...(range==="1 Day"?{hour:"numeric"}:{})}).format(candles[i].lastTime)}</text>)}
    </svg>
    {candles.length===0?<p className="py-4 text-center text-sm text-[#64748B]">No completed trade results for this period.</p>:<div className="flex items-center justify-between gap-3 border-t border-[#E3E8EE] px-1 pt-3">
     <div className="min-w-0"><p className="text-[11px] text-[#64748B]">{selectedCandle?"Selected date":"Latest date"}</p><p className="text-xs font-medium text-[#14253D]">{formatDate((selectedCandle??candles[candles.length-1]).lastTime,dateIncludesTime)}</p></div>
     <div className="text-right"><p className="text-[11px] text-[#64748B]">Profit or loss on this date</p><p className={"text-sm font-semibold tabular-nums "+((selectedCandle??candles[candles.length-1]).change<0?"text-rose-600":"text-emerald-600")}>{money((selectedCandle??candles[candles.length-1]).change)} USDC</p><p className="text-[11px] text-[#64748B]">Total up to this date: {money((selectedCandle??candles[candles.length-1]).close)} USDC</p></div>
    </div>}
   </div>
   <p className="text-xs leading-5 text-[#94A3B8]">Touch or drag the chart to see results for a date. This shows completed trade results, not live prices.</p>
  </div>:<div className="space-y-4 p-4 sm:p-6">
   <div><h2 className="text-base font-semibold">Investment approach</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#475569]">{description}</p></div>
   <div className="border-t border-[#EDF0F5] pt-4"><dl className="grid grid-cols-2 gap-x-4 gap-y-5">{[["Market",stats.market],["Status",stats.status],["Total invested",stats.total+" USDC"],["Room for more investments",stats.capacity+" USDC"],["Completed trades",String(stats.settlements)]].map(([key,value])=><div key={key} className="min-w-0"><dt className="text-xs text-[#94A3B8]">{key}</dt><dd className="mt-1 break-words text-sm font-semibold text-[#14253D]">{value}</dd></div>)}</dl></div>
   {note&&<div className="border-t border-[#EDF0F5] pt-4"><h3 className="text-sm font-semibold">Additional information</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#64748B]">{note}</p></div>}
  </div>}
 </section>;
}
