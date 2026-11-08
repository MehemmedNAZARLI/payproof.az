import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { ListItem } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import type { Schemas } from "@/lib/api";
import { t } from "@/lib/i18n";

export function Identity({ me }: { me: Schemas["Me"] }) {
  return (
    <Card className="flex items-center gap-4">
      <Avatar user={me} size="lg" />
      <div className="min-w-0">
        <h2 className="truncate text-xl font-bold tracking-tight">{me.full_name}</h2>
        <p className="text-text-2 truncate text-sm">{me.title}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="brand" icon="user">
            {t.role[me.role]}
          </Badge>
          <Badge tone="neutral">{me.company.name}</Badge>
        </div>
      </div>
    </Card>
  );
}

export function PermissionRow({ label, granted }: { label: string; granted: boolean }) {
  return (
    <ListItem
      leading={
        <Icon
          name={granted ? "pass" : "na"}
          size={22}
          className={granted ? "text-success" : "text-text-3"}
        />
      }
      title={<span className="text-md font-normal">{label}</span>}
      trailing={
        <Value>
          <span className="sr-only">: </span>
          {granted ? t.profile.yes : t.profile.no}
        </Value>
      }
    />
  );
}

// iOS settings: a white glyph on a tinted rounded square.
export function SettingIcon({ name }: { name: IconName }) {
  return (
    <span className="bg-brand-600 text-brand-foreground grid size-7.5 place-items-center rounded-[7px]">
      <Icon name={name} size={18} strokeWidth={2} />
    </span>
  );
}

export const Value = ({ children }: { children: ReactNode }) => (
  <span className="text-text-3 text-md">{children}</span>
);

export function IdentitySkeleton() {
  return (
    <Card className="flex items-center gap-4" aria-busy="true">
      <Skeleton className="size-16 rounded-full" />
      <div className="flex grow flex-col gap-2">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-5 w-1/2 rounded-full" />
      </div>
    </Card>
  );
}
