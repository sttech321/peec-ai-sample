import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function Callback() {
  return <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/" />;
}

export default function SignInSSOCallback() {
  return (
    <Suspense fallback={null}>
      <Callback />
    </Suspense>
  );
}
