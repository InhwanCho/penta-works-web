"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";

export type Meeting = { id:number; title:string; meetingAt:string; contentMarkdown:string; authorId?:number; authorName:string; updatedByName:string; participantNames:string; revision:number; updatedAt:string };
export function useMeetingAccess() {
  const { session }=useAuth();
  return useQuery({queryKey:["meeting-access",session?.id],queryFn:()=>apiFetch<{allowed:boolean}>("/workspace/meetings/access"),enabled:!!session,staleTime:300_000});
}
