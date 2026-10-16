"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function dashboardSiteSlug(value: string) {
  const trimmed=value.trim();
  return /^\d+$/.test(trimmed)?trimmed.replace(/^0+(?=\d)/,""):trimmed;
}

export default function DashboardScrollTo({offset=120,onTargetRequested,ready=true,layoutKey=""}:{
  offset?:number;
  onTargetRequested?:(siteId:string)=>void;
  ready?:boolean;
  layoutKey?:string;
}) {
  const router=useRouter(),pathname=usePathname(),sp=useSearchParams();
  const requested=sp.get("scrollTo")?.trim()??"";
  const query=sp.toString();
  // Reset filters separately: never scroll against the previous filtered/sorted DOM.
  useEffect(()=>{if(requested)onTargetRequested?.(requested);},[requested,onTargetRequested]);
  useEffect(()=>{
    if(!requested||!ready)return;
    const slug=dashboardSiteSlug(requested);
    let frame=0,cancelled=false,stableSince=performance.now(),lastPosition="";
    const deadline=performance.now()+10000;
    const tick=()=>{
      if(cancelled)return;
      const row=document.getElementById(`site-grid-${slug}`)
        ?? document.getElementById(`site-d-${slug}`) ?? document.getElementById(`site-m-${slug}`);
      const scroller=row?.closest<HTMLElement>("[data-dashboard-scroll]");
      const heading=document.querySelector<HTMLElement>(".dashboard-sticky-columns");
      const navbar=document.querySelector<HTMLElement>(".mobile-safe-header");
      const now=performance.now();
      if(!row || !row.getClientRects().length || scroller?.dataset.dashboardLayoutReady==="false" || document.fonts?.status==="loading"){
        stableSince=now;
        if(now<deadline)frame=requestAnimationFrame(tick);
        return;
      }
      const rect=row.getBoundingClientRect();
      const headerHeight=(heading?.getBoundingClientRect().height??0)+(navbar?.getBoundingClientRect().height??56);
      const signature=[Math.round(rect.top+window.scrollY),Math.round(rect.height),Math.round(headerHeight),scroller?.scrollHeight??0].join(":");
      if(signature!==lastPosition){lastPosition=signature;stableSince=now;}
      if(now-stableSince<180){frame=requestAnimationFrame(tick);return;}
      // Direct positioning avoids a smooth-scroll animation chasing a reordered row.
      window.scrollTo({top:Math.max(0,rect.top+window.scrollY-Math.max(offset,headerHeight+8)),behavior:"instant"});
      scroller?.scrollTo({left:0,behavior:"instant"});
      row.animate([{outline:"2px solid #3b82f6",outlineOffset:"-2px"},{outline:"2px solid transparent",outlineOffset:"-2px"}],{duration:2200});
      const next=new URLSearchParams(query);next.delete("scrollTo");
      if(next.get("view")==="alerts")next.delete("view");
      router.replace(next.size?`${pathname}?${next}`:pathname,{scroll:false});
    };
    frame=requestAnimationFrame(tick);
    return()=>{cancelled=true;cancelAnimationFrame(frame);};
  },[requested,ready,layoutKey,pathname,query,router,offset]);
  return null;
}
