import {ChangePassword} from "@/components/change-password";
import {TwoFactorSettings} from "@/components/two-factor-settings";
import {ExtraTwoFactorMethod} from "@/components/extra-two-factor-method";
import Link from "next/link";
import {CalendarDays,CheckCircle2,ChevronRight,CircleHelp,KeyRound,LifeBuoy,LockKeyhole,Settings2,ShieldCheck,UsersRound,UserRound,Send,ArrowUpFromLine} from "lucide-react";
import {Shell} from "@/components/shell";
import {requireUser} from "@/lib/access";
import {prisma} from "@/lib/db";

export const dynamic="force-dynamic";

const surface="rounded-2xl border border-[#E2E7EF] bg-white";
const iconTile="flex h-10 w-10 shrink-0 items-center justify-center rounded-full";
function shortAddress(s:string){return s.length>20?s.slice(0,7)+"…"+s.slice(-5):s;}
function SettingRow({icon:Icon,title,description,href,status,tint="violet"}:{icon:typeof UserRound;title:string;description:string;href?:string;status?:string;tint?:"violet"|"green"}){
 const row=<div className="flex min-w-0 items-center gap-3 py-4 sm:py-5">
  <span className={iconTile+(tint==="green"?" bg-[#E8F8F1] text-[#07875D]":" bg-[#F1EEFF] text-[#635BFF]")}><Icon size={20} strokeWidth={1.9}/></span>
  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#14253D]">{title}</p><p className="mt-1 text-xs leading-5 text-[#64748B]">{description}</p></div>
  {status&&<span className="hidden shrink-0 items-center gap-1 rounded-full bg-[#E8F8F1] px-2.5 py-1 text-xs font-medium text-[#07875D] sm:inline-flex"><CheckCircle2 size={13}/>{status}</span>}
  {href&&<ChevronRight size={18} className="shrink-0 text-[#60718B]"/>}
 </div>;
 return href?<Link href={href} className="block rounded-lg transition hover:bg-[#FAFAFF] focus-visible:outline-2 focus-visible:outline-[#635BFF]">{row}</Link>:row;
}
export default async function SettingsPage(){
 const session=await requireUser();
 const [user,recipients,twoFactor]=await Promise.all([
  prisma.user.findUnique({where:{id:session.id},select:{handle:true,email:true,emailVerifiedAt:true,createdAt:true}}),
  prisma.userRecipient.findMany({where:{userId:session.id},orderBy:[{createdAt:"desc"},{id:"desc"}],select:{id:true,kind:true,name:true,handle:true,walletAddress:true,network:true,status:true,createdAt:true}}),
  prisma.twoFactor.findUnique({where:{userId:session.id},select:{method:true,emailEnabled:true,secretEncrypted:true}})
 ]);
 if(!user)return <Shell><main className="mx-auto max-w-4xl px-1"><h1 className="text-2xl font-semibold">Settings</h1><p className="mt-2 text-sm text-[#64748B]">Your account details are temporarily unavailable.</p></main></Shell>;
 const sendRecipients=recipients.filter(r=>r.kind==="SEND");
 const withdrawalRecipients=recipients.filter(r=>r.kind==="WITHDRAW");
 const date=new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeZone:"UTC"}).format(user.createdAt);
 const verified=!!user.emailVerifiedAt;
 return <Shell><main className="mx-auto max-w-4xl space-y-4 pb-8 text-[#14253D] sm:space-y-5">
  <header className="px-1 pb-1"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1><p className="mt-1 text-sm text-[#64748B]">Manage your profile, security and preferences.</p></header>
  <section id="profile" className={surface+" scroll-mt-24 p-4 sm:p-6"} aria-label="Profile">
   <div className="flex min-w-0 items-center gap-3 sm:gap-5">
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#EEEAFE] text-[#5145A8] sm:h-20 sm:w-20"><UserRound size={30} strokeWidth={1.7}/></span>
    <div className="min-w-0 flex-1">
     <p className="text-base font-bold text-[#14253D]">@{user.handle}</p>
     <p className="mt-0.5 break-all text-sm text-[#64748B]">{user.email}</p>
     <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium "+(verified?"bg-[#E8F8F1] text-[#07875D]":"bg-[#FFF7E8] text-[#946A22]")}><CheckCircle2 size={13}/>{verified?"Email verified":"Verification pending"}</span>
      <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F7FA] px-2.5 py-1 text-[11px] text-[#64748B]"><CalendarDays size={13}/>Joined {date}</span>
     </div>
    </div>
   </div>
  </section>
  <section id="recipients" className={surface+" scroll-mt-24 p-4 sm:p-6"} aria-labelledby="recipients-heading">
   <div className="flex items-center justify-between gap-3"><h2 id="recipients-heading" className="text-base font-bold sm:text-lg">Saved recipients</h2><span className="text-xs font-semibold text-[#635BFF]">{recipients.length} saved</span></div>
   {recipients.length===0?<div className="mt-4 rounded-xl bg-[#F7F9FC] p-4 text-sm text-[#64748B]">No saved recipients yet. You can save a recipient when sending or withdrawing USDC.</div>:<div className="mt-4 space-y-4">
    {([{kind:"SEND" as const,title:"SEND",items:sendRecipients,icon:Send,color:"text-[#079263]",bg:"bg-[#E8F8F1]"},{kind:"WITHDRAW" as const,title:"WITHDRAW",items:withdrawalRecipients,icon:ArrowUpFromLine,color:"text-[#D47433]",bg:"bg-[#FFF0E5]"}] as const).filter(g=>g.items.length>0).map(g=><div key={g.kind}>
     <div className="flex items-center gap-2 py-1"><span className={"flex h-7 w-7 items-center justify-center rounded-full "+g.bg+" "+g.color}><g.icon size={15}/></span><h3 className="text-xs font-semibold tracking-wide text-[#64748B]">{g.title} ({g.items.length})</h3></div>
     <div className="divide-y divide-[#E9EDF4]">{g.items.map(r=><div key={r.id} className="flex min-w-0 items-center gap-3 py-3">
      <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold "+(g.kind==="SEND"?"bg-[#F0EDFF] text-[#635BFF]":"bg-[#FFF0E5] text-[#D47433]")}>{r.name.slice(0,1).toUpperCase()}</span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{r.name}</p><p className="mt-1 truncate text-xs text-[#64748B]">{g.kind==="SEND"?"@"+r.handle:shortAddress(r.walletAddress??"")}{r.network?" · "+r.network:""}</p></div>
      <span className={"rounded-full px-3 py-1 text-[11px] font-semibold "+(g.kind==="SEND"?"bg-[#E8F8F1] text-[#07875D]":"bg-[#FFF0E5] text-[#BA6327]")}>{g.kind==="SEND"?"Send":"Withdraw"}</span>
     </div>)}</div>
    </div>)}
   </div>}
  </section>
  <section id="security" className={surface+" scroll-mt-24 divide-y divide-[#E9EDF4] px-4 sm:px-6"} aria-label="Security and account">
   <div className="py-5">{twoFactor?<ExtraTwoFactorMethod defaultMethod={twoFactor.method as "APP"|"EMAIL"} methods={[...(twoFactor.emailEnabled?["EMAIL" as const]:[]),...(twoFactor.secretEncrypted?["APP" as const]:[])]}/>:<TwoFactorSettings enabled={false} method={null}/>}</div>
  </section>
  <ChangePassword/>
  <section id="preferences" className={surface+" scroll-mt-24 divide-y divide-[#E9EDF4] px-4 sm:px-6"} aria-label="Preferences and support">
   <div id="support" className="scroll-mt-24"><SettingRow icon={LifeBuoy} title="Help & support" description="Privacy, terms and support resources."/></div>
  </section>
 </main></Shell>;
}
