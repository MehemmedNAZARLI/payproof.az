import notifications from "@fixtures/notifications.json";

import type { Schemas } from "../client";
import { isRead, markRead, sessionApprovals } from "./session-db";
import { mockUuid, packageList, toUtc, userRef, userSlug } from "./store";

// shortcut: GET/POST /v1/notifications over the fixtures plus this session's events until S-06.
// An approval notifies the package owner, as the prototype's dApprove does.

type Notification = Schemas["Notification"];
type Entry = { userSlug: string; notification: Notification };

const ref = (packageId: string): Schemas["PackageRef"] | null => {
  const item = packageList.find((p) => p.id === packageId);
  return item ? { id: item.id, invoice_number: item.invoice_number ?? "" } : null;
};

function entries(): Entry[] {
  const fixtures = notifications.map((n, i) => ({
    userSlug: n.user_id,
    read: n.read,
    notification: {
      id: `0193a000-0000-7000-800b-${String(i + 1).padStart(12, "0")}`,
      text: n.text,
      package: ref(mockUuid("package", n.package_id)),
      created_at: toUtc(n.created_at),
      read_at: null,
    },
  }));
  const session = sessionApprovals().flatMap((a, i) => {
    const owner = packageList.find((p) => p.id === a.packageId)?.owner;
    const pkg = ref(a.packageId);
    if (!owner || !pkg) return [];
    const ownerSlug = userSlug(owner.id);
    if (!ownerSlug) return [];
    return [
      {
        userSlug: ownerSlug,
        read: false,
        notification: {
          id: `0193a000-0000-7000-800b-9${String(i + 1).padStart(11, "0")}`,
          text: `${pkg.invoice_number} ${userRef(a.approverSlug).full_name} tərəfindən təsdiqləndi — paket göndərilməyə hazırdır.`,
          package: pkg,
          created_at: a.approvedAt,
          read_at: null,
        },
      },
    ];
  });
  // The mock keeps no read time, so a read notification reports its creation time.
  return [...fixtures, ...session].map(({ userSlug, read, notification: n }) => ({
    userSlug,
    notification: { ...n, read_at: read || isRead(n.id) ? n.created_at : null },
  }));
}

const of = (userSlug: string) =>
  entries()
    .filter((e) => e.userSlug === userSlug)
    .map((e) => e.notification)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));

export function notificationPage(userSlug: string, unreadOnly: boolean, limit: number) {
  const all = of(userSlug);
  const items = unreadOnly ? all.filter((n) => n.read_at === null) : all;
  return {
    items: items.slice(0, limit),
    next_cursor: null,
    unread_count: all.filter((n) => n.read_at === null).length,
  };
}

/** False when the notification is not this user's (404). */
export function readOne(userSlug: string, id: string): boolean {
  if (!of(userSlug).some((n) => n.id === id)) return false;
  markRead([id]);
  return true;
}

export const readAll = (userSlug: string) => markRead(of(userSlug).map((n) => n.id));
