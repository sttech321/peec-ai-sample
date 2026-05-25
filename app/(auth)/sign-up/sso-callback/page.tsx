import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function Callback() {
  return (
    <AuthenticateWithRedirectCallback
      signUpFallbackRedirectUrl="/setup"
      signInFallbackRedirectUrl="/"
    />
  );
}

export default function SignUpSSOCallback() {
  return (
    <Suspense fallback={null}>
      <Callback />
    </Suspense>
  );
}
