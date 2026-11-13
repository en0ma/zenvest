import {redirect} from "next/navigation";
import {Shell} from "@/components/shell";
import {BotManagerClient} from "@/components/bot-manager-client";
import {currentBotManager} from "@/lib/bot-manager-access";
export const dynamic="force-dynamic";
export default async function BotManagerPage(){
 if(!await currentBotManager())redirect("/dashboard");
 return <Shell><main className="mx-auto max-w-5xl space-y-6">
  <header><h1 className="text-3xl font-bold text-[#14253D]">Bot Manager</h1>
   <p className="mt-2 text-sm text-slate-600">Create integrations and manage credentials for your own bots. Strategies are hidden from investors until approved by Zenvest administrators.</p>
  </header>
  <BotManagerClient/>
 </main></Shell>;
}
