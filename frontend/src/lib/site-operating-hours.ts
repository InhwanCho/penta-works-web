"use client";
import {useQuery} from "@tanstack/react-query";
import {useEffect,useState} from "react";
import {apiFetch} from "@/lib/api";
import {useAuth} from "@/components/provider/auth-provider";
export const WEEKDAYS=[['MONDAY','월요일'],['TUESDAY','화요일'],['WEDNESDAY','수요일'],['THURSDAY','목요일'],['FRIDAY','금요일'],['SATURDAY','토요일'],['SUNDAY','일요일']] as const;
export type HoursWindow={closed:boolean;allDay:boolean;start:string|null;end:string|null};
export type OperatingHours={enabled:boolean;days:Record<string,HoursWindow>;holidayMode:'WEEKDAY'|'CUSTOM'|'CLOSED';holidayWindow:HoursWindow;exceptions:Record<string,HoursWindow>;graceMinutes:number};
export type OperatingStatus={enabled:boolean;monitoring:boolean;label:string;sessionStart:string|null;monitoringStart:string|null;nextMonitoringAt:string|null};
export type HoursView={settings:OperatingHours;status:OperatingStatus};
export function useOperatingHours(){
 const {session}=useAuth();const [ready,setReady]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setReady(true),0);return()=>clearTimeout(timer);},[]);
 return useQuery({queryKey:['site-operating-hours',session?.id],queryFn:()=>apiFetch<Record<string,HoursView>>('/alerts/operating-hours'),enabled:ready&&!!session,staleTime:30_000,refetchInterval:60_000});
}
export function nextMonitoringLabel(value:string|null){return value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):'';}
