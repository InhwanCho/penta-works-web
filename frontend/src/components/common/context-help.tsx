"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
type Explanation = {title:string;message:string};
const eventName="mreyes-context-help";
export default function HelpButton({title,message}:Explanation) {
  return <button type="button" data-context-help aria-label={`${title} 도움말`} onClick={event=>{event.preventDefault();event.stopPropagation();window.dispatchEvent(new CustomEvent<Explanation>(eventName,{detail:{title,message}}));}} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg align-middle text-sky-800 hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-sky-600 dark:text-sky-200 dark:hover:bg-slate-700"><span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs font-extrabold">?</span></button>;
}
/** One shared card escapes sticky table clipping and replaces the previous explanation. */
export function ContextHelpHost() {
  const [help,setHelp]=useState<Explanation|null>(null);
  const pathname=usePathname();
  useEffect(()=>{
    setHelp(null);
    let timer:ReturnType<typeof setTimeout>|undefined;
    const close=()=>{clearTimeout(timer);timer=undefined;setHelp(null);};
    const show=(event:Event)=>{
      const explanation=(event as CustomEvent<Explanation>).detail;
      if(!explanation?.title||!explanation?.message)return;
      clearTimeout(timer);setHelp(explanation);timer=setTimeout(close,3000);
    };
    const outside=(event:PointerEvent)=>{if(event.target instanceof Element&&!event.target.closest('[data-context-help]'))close();};
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")close();};
    window.addEventListener(eventName,show);window.addEventListener("pointerdown",outside);window.addEventListener("keydown",key);
    return()=>{clearTimeout(timer);window.removeEventListener(eventName,show);window.removeEventListener("pointerdown",outside);window.removeEventListener("keydown",key);};
  },[pathname]);
  if(!help)return null;
  return createPortal(<aside data-context-help role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-[150] mx-auto max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-4 text-left text-white shadow-xl"><p className="text-base font-extrabold">{help.title}</p><p className="mt-1 break-words text-sm font-normal leading-6">{help.message}</p></aside>,document.body);
}
