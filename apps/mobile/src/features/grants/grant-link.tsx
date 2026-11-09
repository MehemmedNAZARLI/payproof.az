import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { env } from "@/lib/env";

export function GrantLink() {
  if (!env.apiMock) return null;
  return (
    <Link
      href="/grants"
      className="bg-accent-soft text-accent-ink press my-5 flex items-center gap-3 rounded-lg p-4"
    >
      <Icon name="package" size={24} />
      <span className="min-w-0 flex-1">
        <span className="block text-subhead font-semibold">UNEC · Student grant</span>
        <span className="mt-1 block text-caption">
          Invoices + bank and card statements → expense act
        </span>
      </span>
      <Icon name="chev-r" size={18} />
    </Link>
  );
}
