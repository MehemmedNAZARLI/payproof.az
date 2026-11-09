"use client";

import { shellText } from "@payproof/api-client/i18n";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLiveUpdates } from "@/lib/live";
import { useLiveToasts } from "@/lib/live-toasts";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

const COLLAPSED_KEY = "payproof.sidebar-collapsed";

// The shell renders only after AuthGuard has the user (client side), so storage is readable here.
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
};

export function AppShell({ children }: { children: ReactNode }) {
  useLiveUpdates(); // one live event stream per signed-in app (ADR-0010)
  useLiveToasts();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [navOpen, setNavOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "0" : "1");
    } catch {
      // per-session only
    }
  };

  // The drawer is mobile-only: widening the window must not leave an invisible modal open.
  useEffect(() => {
    const wide = matchMedia("(min-width: 768px)");
    const close = () => wide.matches && setNavOpen(false);
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      <a
        href="#content"
        className="bg-brand text-brand-foreground sr-only z-50 rounded-md px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {shellText.skipToContent}
      </a>
      <Topbar menuButtonRef={menuButton} navOpen={navOpen} onOpenNav={() => setNavOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "bg-surface border-border shrink-0 border-r transition-[width] duration-base ease-base max-md:hidden",
            collapsed ? "w-[72px]" : "w-60",
          )}
        >
          <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
        </aside>
        <main
          id="content"
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-y-auto p-4 outline-none md:p-6"
        >
          {children}
        </main>
      </div>

      <Dialog.Root open={navOpen} onOpenChange={setNavOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-overlay fixed inset-0 z-40" />
          <Dialog.Content
            aria-describedby={undefined}
            // not a Dialog.Trigger, so Radix can't restore focus by itself
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              menuButton.current?.focus();
            }}
            className="bg-surface shadow-3 fixed inset-y-0 left-0 z-50 w-[272px] max-w-[85vw]"
          >
            <Dialog.Title className="sr-only">{shellText.menu}</Dialog.Title>
            <Sidebar collapsed={false} onNavigate={() => setNavOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
