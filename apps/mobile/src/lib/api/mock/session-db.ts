// shortcut: the writes the in-page mock accepts — approvals and read notifications — until S-06
// brings the shared mock store. Kept in this tab's sessionStorage, so a reload keeps the demo where
// it was and a new tab starts from the fixtures again. Plain data only: the handlers decide.

export type SessionApproval = {
  id: string;
  packageId: string;
  packageVersion: number;
  requirementSetVersion: number;
  approverSlug: string;
  approvedAt: string;
};

type Replay = { fingerprint: string; approvalId: string };
type Db = { approvals: SessionApproval[]; read: string[]; replays: Record<string, Replay> };

const KEY = "payproof.mock-db";
const empty = (): Db => ({ approvals: [], read: [], replays: {} });

let memory: Db | undefined;

function storage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function load(): Db {
  if (memory) return memory;
  let db = empty();
  try {
    const raw = storage()?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") db = { ...db, ...(parsed as Partial<Db>) };
  } catch {
    // a damaged entry: start from the fixtures
  }
  memory = db;
  return db;
}

function save(db: Db) {
  memory = db;
  try {
    storage()?.setItem(KEY, JSON.stringify(db));
  } catch {
    // quota or blocked storage: this page keeps the state in memory
  }
}

export const sessionApprovals = (): readonly SessionApproval[] => load().approvals;

export function addApproval(approval: SessionApproval) {
  const db = load();
  save({ ...db, approvals: [...db.approvals, approval] });
}

/** What an Idempotency-Key answered before, if it was used. */
export const replayOf = (key: string): Replay | undefined => load().replays[key];

export function rememberReplay(key: string, replay: Replay) {
  const db = load();
  save({ ...db, replays: { ...db.replays, [key]: replay } });
}

export const isRead = (notificationId: string) => load().read.includes(notificationId);

export function markRead(notificationIds: readonly string[]) {
  const db = load();
  const fresh = notificationIds.filter((id) => !db.read.includes(id));
  if (fresh.length) save({ ...db, read: [...db.read, ...fresh] });
}

/** Back to the fixtures (tests). */
export function resetSessionDb() {
  memory = undefined;
  storage()?.removeItem(KEY);
}
