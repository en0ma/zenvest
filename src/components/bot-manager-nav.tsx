import Link from "next/link";
import {currentBotManager} from "@/lib/bot-manager-access";
export async function BotManagerNav({variant}:{variant:"menu"|"sidebar"}){
 if(!await currentBotManager())return null;
 return <Link href="/bot-manager" className={variant==="sidebar"?
 "block rounded-xl px-3 py-3 text-sm font-semibold text-[#14253D] hover:bg-[#F0EFFB]":
 "block rounded-lg px-3 py-2 font-semibold text-[#14253D] hover:bg-[#F0EFFB]"}>Bot Manager</Link>;
}
