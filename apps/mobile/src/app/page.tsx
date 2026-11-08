"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/lib/session";

// The installed app starts here (manifest start_url): home with a session, the login without.
export default function StartPage() {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    if (session !== undefined) router.replace(session ? "/home" : "/login");
  }, [session, router]);
  return null;
}
