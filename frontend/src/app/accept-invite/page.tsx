import AcceptInviteClient from "@/components/auth/accept-invite-client";
import AuthPageLoading from "@/components/auth/auth-page-loading";
import { Suspense } from "react";

export default function AcceptInvitePage() {
  return <Suspense fallback={<AuthPageLoading />}><AcceptInviteClient /></Suspense>;
}
