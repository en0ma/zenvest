"use client";
import {useEffect,useRef} from "react";
export function AutoCloseDetails({children,className}:{children:React.ReactNode;className?:string}){
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  const closeOnOutside=(event:PointerEvent)=>{if(ref.current?.open && !ref.current.contains(event.target as Node))ref.current.open=false;};
  const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape" && ref.current?.open)ref.current.open=false;};
  document.addEventListener("pointerdown",closeOnOutside);
  document.addEventListener("keydown",closeOnEscape);
  return ()=>{document.removeEventListener("pointerdown",closeOnOutside);document.removeEventListener("keydown",closeOnEscape);};
 },[]);
 return <details ref={ref} className={className}>{children}</details>;
}
