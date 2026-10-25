import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import {Shell} from "@/components/shell";
import {requireUser} from "@/lib/access";
import {prisma} from "@/lib/db";
import {formatUsdc} from "@/lib/usdc-money";
import {ActivateDepositWallet,CopyDepositAddress} from "@/components/deposit-wallet-actions";
import {WalletActions} from "@/components/wallet-unified-actions";

export const dynamic="force-dynamic";
const SIZE=8;
const pendingWithdrawalStatuses=["PENDING","SUBMITTING","PROCESSING","REVIEW"] as const;
function short(value:string){return value.length>21?value.slice(0,7)+"..."+value.slice(-5):value;}
function date(value:Date){return value.toLocaleString("en-US",{timeZone:"UTC",dateStyle:"medium",timeStyle:"short"})+" UTC";}
export default async function WalletPage({searchParams}:{searchParams:Promise<{activityPage?:string;type?:string}>}){
 const user=await requireUser();
 const params=await searchParams;
 const type=["All","Deposit","Withdraw","Send @"].includes(params.type??"")?params.type!:"All";
 const wanted=Number(params.activityPage??"1");
 const requested=Number.isSafeInteger(wanted)&&wanted>0?Math.min(1000,wanted):1;
 const [account,depositWallet,withdrawHolds,allocationHolds,contacts,depositCount,withdrawCount,sentCount,receivedCount]=await Promise.all([
  prisma.user.findUniqueOrThrow({where:{id:user.id},select:{unallocated:true}}),
  prisma.investorDepositWallet.findUnique({where:{userId:user.id}}),
  prisma.withdrawal.aggregate({where:{userId:user.id,status:{in:[...pendingWithdrawalStatuses]}},_sum:{grossUsdcMicros:true}}),
  prisma.positionAllocation.aggregate({where:{userId:user.id,kind:"ALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","REVIEW"]}},_sum:{amountUsdcMicros:true}}),
  prisma.userRecipient.findMany({where:{userId:user.id,status:"COMPLETED"},select:{id:true,name:true,kind:true,handle:true,walletAddress:true},orderBy:{createdAt:"desc"}}),
  prisma.blockchainDeposit.count({where:{wallet:{userId:user.id}}}),
  prisma.withdrawal.count({where:{userId:user.id}}),
  prisma.send.count({where:{senderUserId:user.id}}),
  prisma.send.count({where:{recipientUserId:user.id}})
 ]);
 const reserve=(withdrawHolds._sum.grossUsdcMicros??0n)+(allocationHolds._sum.amountUsdcMicros??0n);
 const available=account.unallocated>reserve?account.unallocated-reserve:0n;
 const total=(type==="All"||type==="Deposit"?depositCount:0)+(type==="All"||type==="Withdraw"?withdrawCount:0)+(type==="All"||type==="Send @"?sentCount+receivedCount:0);
 const totalPages=Math.max(1,Math.ceil(total/SIZE));
 const page=Math.min(requested,totalPages);
 const take=page*SIZE;
 const [deposits,withdrawals,sent,received]=await Promise.all([
  type==="All"||type==="Deposit"?prisma.blockchainDeposit.findMany({where:{wallet:{userId:user.id}},orderBy:[{createdAt:"desc"},{id:"desc"}],take,select:{id:true,createdAt:true,amountUsdcMicros:true,status:true,transactionHash:true,senderAddress:true}}):Promise.resolve([]),
  type==="All"||type==="Withdraw"?prisma.withdrawal.findMany({where:{userId:user.id},orderBy:[{createdAt:"desc"},{id:"desc"}],take,select:{id:true,createdAt:true,grossUsdcMicros:true,status:true,destinationAddress:true}}):Promise.resolve([]),
  type==="All"||type==="Send @"?prisma.send.findMany({where:{senderUserId:user.id},orderBy:[{createdAt:"desc"},{id:"desc"}],take,select:{id:true,createdAt:true,amount:true,status:true,recipientHandle:true}}):Promise.resolve([]),
  type==="All"||type==="Send @"?prisma.send.findMany({where:{recipientUserId:user.id},orderBy:[{createdAt:"desc"},{id:"desc"}],take,select:{id:true,createdAt:true,amount:true,status:true,senderHandle:true}}):Promise.resolve([])
 ]);
 const events=[
  ...deposits.map(x=>({id:"d"+x.id,at:x.createdAt,description:"Deposit from "+(x.senderAddress?short(x.senderAddress):"unknown wallet"),detail:"Tx "+short(x.transactionHash),amount:"+"+formatUsdc(x.amountUsdcMicros),status:x.status==="CONFIRMED"?"Confirmed":"Confirming",incoming:true,kind:"Deposit"})),
  ...withdrawals.map(x=>({id:"w"+x.id,at:x.createdAt,description:"Withdraw to "+short(x.destinationAddress),detail:"External · Solana",amount:"−"+formatUsdc(x.grossUsdcMicros),status:x.status,incoming:false,kind:"Withdraw"})),
  ...sent.map(x=>({id:"s"+x.id,at:x.createdAt,description:"Sent to @"+x.recipientHandle,detail:"Internal transfer",amount:"−"+formatUsdc(x.amount),status:x.status,incoming:false,kind:"Send @"})),
  ...received.map(x=>({id:"r"+x.id,at:x.createdAt,description:"Received from @"+x.senderHandle,detail:"Internal transfer",amount:"+"+formatUsdc(x.amount),status:x.status,incoming:true,kind:"Send @"}))
 ].sort((a,b)=>b.at.getTime()-a.at.getTime()||a.id.localeCompare(b.id)).slice((page-1)*SIZE,page*SIZE);
 const qr=depositWallet?.status==="ACTIVE"&&depositWallet.address?await QRCode.toDataURL(depositWallet.address,{errorCorrectionLevel:"M",width:220,margin:2}):null;
 const query=(next:number)=>"/wallet?type="+encodeURIComponent(type)+"&activityPage="+next+"#wallet-activity";
 const deposit=<div className="space-y-3">
  <h3 className="text-sm font-semibold text-[#14253D]">Your Solana deposit address</h3>
  {depositWallet?.status==="ACTIVE"&&depositWallet.address?<><div className="flex justify-center rounded-xl bg-[#F8FAFC] p-4">{qr&&<Image src={qr} alt="QR code containing your deposit address" width={200} height={200} unoptimized/>}</div><p className="break-all rounded-xl bg-[#F8FAFC] p-3 font-mono text-xs">{depositWallet.address}</p><CopyDepositAddress address={depositWallet.address}/><p className="text-xs text-[#64748B]">Only send USDC on Solana. Funds credit after confirmation.</p></>:depositWallet?<p className="text-sm text-[#64748B]">Your wallet activation requires attention. Contact support before depositing.</p>:<><p className="text-sm text-[#64748B]">Activate a personal Solana USDC deposit address.</p><ActivateDepositWallet/></>}
 </div>;
 return <Shell><main className="mx-auto max-w-5xl space-y-4 pb-8 sm:space-y-5">
  <header className="px-1"><h1 className="text-2xl font-semibold tracking-tight text-[#14253D]">Manage funds</h1></header>
  <section aria-label="Wallet balances" className="rounded-2xl border border-[#E3E8EE] bg-[#F2F3FF] p-4 sm:p-6">
   <p className="text-sm text-[#64748B]">Gross wallet balance</p><p className="mt-2 break-words text-[clamp(1.8rem,6vw,3rem)] font-semibold tracking-tight text-[#14253D]">{formatUsdc(account.unallocated)}</p>
   <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#DDE3F5] pt-4"><div><dt className="text-xs text-[#64748B]">Available</dt><dd className="mt-1 text-base font-semibold text-[#14253D]">{formatUsdc(available)}</dd></div><div><dt className="text-xs text-[#64748B]">Reserved</dt><dd className="mt-1 text-base font-semibold text-[#14253D]">{formatUsdc(reserve)}</dd></div></dl>
   <p className="mt-3 text-xs leading-5 text-[#64748B]">Reserved funds are held for pending withdrawals and allocation requests.</p>
  </section>
  <WalletActions balanceMicros={available.toString()} unallocatedMicros={account.unallocated.toString()} pendingMicros={(withdrawHolds._sum.grossUsdcMicros??0n).toString()} contacts={contacts} deposit={deposit}/>
  <section id="wallet-activity" aria-label="Wallet activity" className="scroll-mt-5 rounded-2xl border border-[#E3E8EE] bg-white p-4 sm:p-6">
   <h2 className="text-base font-semibold text-[#14253D]">Wallet activity</h2><p className="mt-1 text-xs text-[#64748B]">Deposits, withdrawals, sent and received transfers</p>
   <nav aria-label="Activity filters" className="mt-4 flex flex-wrap gap-2">{["All","Deposit","Withdraw","Send @"].map(t=><Link key={t} href={"/wallet?type="+encodeURIComponent(t)+"&activityPage=1#wallet-activity"} aria-current={type===t?"page":undefined} className={"rounded-lg px-3 py-2 text-xs font-semibold "+(type===t?"bg-[#EEEAFE] text-[#5149DB]":"bg-[#F8FAFC] text-[#64748B]")}>{t}</Link>)}</nav>
   {events.length?<div className="mt-3 divide-y divide-[#EDF0F5]">{events.map(e=><article key={e.id} className="flex items-center gap-3 py-3"><div className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold "+(e.incoming?"bg-[#EFFAF4] text-[#059669]":"bg-[#F3F1FF] text-[#635BFF]")}>{e.incoming?"↓":"↑"}</div><div className="min-w-0 flex-1"><p className="text-sm font-medium text-[#14253D]">{e.description}</p><p className="mt-1 text-xs text-[#64748B]">{date(e.at)} · {e.status}</p><p className="mt-1 text-[11px] text-[#94A3B8]">{e.detail}</p></div><span className={"text-right text-xs font-semibold tabular-nums sm:text-sm "+(e.incoming?"text-emerald-700":"text-[#14253D]")}>{e.amount}</span></article>)}</div>:<p className="mt-4 rounded-xl bg-[#F8FAFC] p-4 text-sm text-[#64748B]">No wallet activity yet.</p>}
   <nav aria-label="Wallet activity pagination" className="mt-4 flex items-center justify-between gap-2 border-t border-[#EDF0F5] pt-4"><span className="text-xs text-[#64748B]">Page {page} of {totalPages}</span><div className="flex gap-2">{page>1?<Link href={query(page-1)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Previous</Link>:<span aria-disabled="true" className="rounded-lg border px-3 py-2 text-xs text-[#94A3B8]">Previous</span>}{page<totalPages?<Link href={query(page+1)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Next</Link>:<span aria-disabled="true" className="rounded-lg border px-3 py-2 text-xs text-[#94A3B8]">Next</span>}</div></nav>
  </section>
 </main></Shell>;
}
