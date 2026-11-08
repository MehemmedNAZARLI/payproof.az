"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { signOutReason, useSession } from "@/lib/session";

import { loginHref } from "../next-path";

/**
 * Renders its children only with a session. Without one it goes to the login, which brings the
 * user back here afterwards — unless they signed out themselves, which starts over from home.
 * This guards navigation only; every API request is authorised by the server.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (session !== null) return;
    router.replace(signOutReason() === "user" ? "/login" : loginHref(pathname, location.search));
  }, [session, pathname, router]);

  // undefined while hydrating: render nothing rather than flash a screen that may not be allowed.
  return session ? children : null;
}
