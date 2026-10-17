"use client";
import { signOut } from "next-auth/react";
export function Signout(){return <button className="mt-5 text-sm text-mint underline" onClick={()=>signOut({callbackUrl:"/"})}>Sign out</button>;}
