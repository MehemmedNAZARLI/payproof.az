"use client";

import { loginText, roleLabel, shellText } from "@payproof/api-client/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { toast } from "sonner";
import { useDevLogin, useDevUsers, useMe } from "@/features/auth";
import { setToken } from "@/lib/auth";

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

const menuItem =
  "data-[highlighted]:bg-surface-2 flex min-h-10 pointer-coarse:min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 outline-none";

/** Account menu: switch demo user (dev auth) or sign out. Radix gives the menu keyboard support. */
export function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe().data;
  const users = useDevUsers();
  const login = useDevLogin();
  if (!me) return null;

  const switchTo = (id: string) => {
    if (id === me.id) return;
    login.mutate(id, {
      onSuccess: ({ user }) => toast.success(loginText.signedInAs(user.full_name)),
    });
  };
  const signOut = () => {
    setToken(null);
    queryClient.clear();
    router.replace("/login");
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="hover:bg-surface-2 focus-visible:ring-ring flex min-h-10 pointer-coarse:min-h-11 shrink-0 items-center gap-2 rounded-md px-1.5 text-left outline-none focus-visible:ring-2">
        <span
          aria-hidden
          className="bg-brand-50 text-brand-700 grid size-8 place-items-center rounded-full text-xs font-bold"
        >
          {initials(me.full_name)}
        </span>
        <span className="flex flex-col leading-tight max-lg:sr-only">
          <span className="font-semibold">{me.full_name}</span>
          <span className="text-text-3 text-xs">
            {roleLabel[me.role]} · {me.title}
          </span>
        </span>
        <ChevronDown aria-hidden className="text-text-3 size-4 max-lg:hidden" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="bg-surface border-border shadow-3 z-50 w-80 rounded-lg border p-1.5"
        >
          <DropdownMenu.Label className="text-text-3 px-3 py-2 text-xs font-bold uppercase">
            {shellText.switchAccount}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={me.id} onValueChange={switchTo}>
            {users.data?.map((u) => (
              <DropdownMenu.RadioItem key={u.id} value={u.id} className={menuItem}>
                <span className="grow">
                  <b className="block">{u.full_name}</b>
                  <span className="text-text-3 text-sm">
                    {roleLabel[u.role]} · {u.title}
                  </span>
                </span>
                <DropdownMenu.ItemIndicator>
                  <Check aria-hidden className="text-brand size-4" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="bg-border my-1 h-px" />
          <DropdownMenu.Item onSelect={signOut} className={menuItem}>
            <LogOut aria-hidden className="size-4" />
            {shellText.signOut}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
