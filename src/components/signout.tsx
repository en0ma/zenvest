"use client";
import { signOut } from "next-auth/react";
export function Signout({mobile=false}:{mobile?:boolean}){return <button className={mobile?"flex w-full items-center rounded-lg px-0 py-3 text-sm font-semibold text-[#292725] hover:text-[#91603f]":"mt-5 text-sm text-mint underline"} onClick={async()=>{await signOut({redirect:false});window.location.replace(window.location.origin+"/")}}>Sign out</button>;}
