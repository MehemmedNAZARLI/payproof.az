import Link from "next/link";

import { Icon } from "@/components/ui/icon";

export default function NotFound() {
  return (
    <main className="px-safe pt-safe pb-safe mx-auto flex min-h-dvh max-w-app flex-col items-center justify-center gap-4 text-center">
      <Icon name="file" size={44} className="text-accent" />
      <h1 className="text-title1 font-bold">Page not found</h1>
      <p className="text-text-2 text-body">
        This page is unavailable. Your document packages are on the home screen.
      </p>
      <Link
        href="/home"
        className="bg-accent-fill text-accent-foreground mt-2 flex min-h-11 items-center rounded-lg px-5 text-subhead font-semibold"
      >
        Back to home
      </Link>
    </main>
  );
}
