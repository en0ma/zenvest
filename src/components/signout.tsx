"use client";
import {signOut} from "next-auth/react";
import {LogOut} from "lucide-react";

export function Signout({mobile=false}:{mobile?:boolean}){
 return <button type="button" className={mobile?"flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-[#0A2540] hover:bg-[#F6F9FC] hover:text-[#635BFF]":"mt-5 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-[#0A2540] hover:bg-[#F6F9FC] hover:text-[#635BFF]"} onClick={async()=>{await signOut({redirect:false});window.location.replace(window.location.origin+"/")}}>
  <LogOut size={17} aria-hidden="true"/><span>Sign out</span>
 </button>;
}
