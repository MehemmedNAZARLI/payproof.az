"use client";

import { shellText } from "@payproof/api-client/i18n";
import { Menu, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, Ref } from "react";
import { NotificationBell } from "@/features/notifications";
import { UserMenu } from "./user-menu";

const iconButton =
  "text-text-2 hover:bg-surface-2 hover:text-text focus-visible:ring-ring inline-grid size-10 shrink-0 pointer-coarse:size-11 place-items-center rounded-md outline-none focus-visible:ring-2 disabled:opacity-50";

export function Topbar({
  onOpenNav,
  navOpen = false,
  menuButtonRef,
}: {
  onOpenNav: () => void;
  navOpen?: boolean;
  /** The drawer returns focus here when it closes. */
  menuButtonRef?: Ref<HTMLButtonElement>;
}) {
  const router = useRouter();

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    router.push(q ? `/packages?q=${encodeURIComponent(q)}` : "/packages");
  };

  return (
    <header className="bg-surface border-border flex h-topbar shrink-0 items-center gap-3 border-b px-3 md:px-5">
      <button
        ref={menuButtonRef}
        type="button"
        aria-label={shellText.openMenu}
        aria-haspopup="dialog"
        aria-expanded={navOpen}
        onClick={onOpenNav}
        className={`${iconButton} md:hidden`}
      >
        <Menu aria-hidden className="size-5" />
      </button>
      <Link
        href="/overview"
        className="focus-visible:ring-ring flex shrink-0 items-center gap-2.5 rounded-md pointer-coarse:min-h-11 text-lg font-bold tracking-tight outline-none focus-visible:ring-2"
      >
        <span className="bg-brand text-brand-foreground grid size-[30px] place-items-center rounded-[9px]">
          <ShieldCheck aria-hidden className="size-[18px]" strokeWidth={2.4} />
        </span>
        <span className="max-md:sr-only">PayProof</span>
      </Link>
      <span
        title={shellText.demoTagTitle}
        className="bg-warning-bg text-warning shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold max-md:hidden"
      >
        {shellText.demoTag}
      </span>

      <form role="search" onSubmit={search} className="mx-auto w-full max-w-md min-w-0">
        <label className="border-border-strong bg-surface focus-within:ring-ring flex h-10 items-center gap-2 rounded-md border px-3 pointer-coarse:h-11 focus-within:ring-2">
          <Search aria-hidden className="text-text-3 size-4 shrink-0" />
          <span className="sr-only">{shellText.searchLabel}</span>
          <input
            type="search"
            name="q"
            maxLength={100}
            autoComplete="off"
            placeholder={shellText.searchPlaceholder}
            className="placeholder:text-text-3 h-full w-full min-w-0 bg-transparent outline-none"
          />
        </label>
      </form>

      <NotificationBell className={iconButton} />
      <UserMenu />
    </header>
  );
}
