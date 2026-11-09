import company from "@fixtures/company.json";
import customers from "@fixtures/customers.json";
import expected from "@fixtures/expected.json";
import packages from "@fixtures/packages.json";
import users from "@fixtures/users.json";
import type { Schemas } from "@payproof/api-client";

// shortcut: read-only stand-in for @payproof/mocks (S-06). Statuses and blockers come from
// expected.json (the prototype engine's golden output) instead of a ported rule engine.

type Role = Schemas["Role"];
type Permission = Schemas["Permission"];
type PackageItem = Schemas["PackageListItem"];

// Fixture slugs → UUIDs as in the contract's examples (u1 → …-8000-000000000001).
const ID_SPACE = { user: "8000", customer: "8001", package: "8002" } as const;
const COMPANY_ID = "0193a000-0000-7000-8000-00000000c0a1";

export function mockUuid(kind: keyof typeof ID_SPACE, slug: string): string {
  const digits = slug.replace(/\D/g, "");
  if (!digits) throw new Error(`Fixture slug without a number: ${slug}`);
  return `0193a000-0000-7000-${ID_SPACE[kind]}-${digits.padStart(12, "0")}`;
}

// docs/architecture/security.md — the server's matrix, mirrored only inside the mock.
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  operator: ["VIEW", "EDIT_PACKAGE", "MANAGE_TASKS", "EXPORT_PACKAGE", "DELETE_PACKAGE"],
  approver: [
    "VIEW",
    "EDIT_PACKAGE",
    "MANAGE_TASKS",
    "MANAGE_REQUIREMENTS",
    "APPROVE_PACKAGE",
    "EXPORT_PACKAGE",
  ],
  readonly: ["VIEW"],
  admin: [
    "VIEW",
    "EDIT_PACKAGE",
    "MANAGE_TASKS",
    "MANAGE_REQUIREMENTS",
    "EXPORT_PACKAGE",
    "DELETE_PACKAGE",
  ],
  assignee: [],
};

function oneOf<T extends string>(allowed: readonly T[], value: string): T {
  if (!(allowed as readonly string[]).includes(value))
    throw new Error(`Unexpected fixture value: ${value}`);
  return value as T;
}

const ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];
const STATUSES = [
  "PROCESSING",
  "NEEDS_REVIEW",
  "NEEDS_FIX",
  "READY_FOR_APPROVAL",
  "APPROVED_READY",
  "EXPORTED",
] as const;
const CURRENCIES = ["AZN", "USD"] as const;

const userBySlug = new Map(users.map((u) => [u.id, u]));

export function userRef(slug: string): Schemas["UserRef"] {
  const u = userBySlug.get(slug);
  if (!u) throw new Error(`Unknown fixture user: ${slug}`);
  return {
    id: mockUuid("user", u.id),
    full_name: u.full_name,
    title: u.title,
    role: oneOf(ROLES, u.role),
  };
}

/** The signed-in user, or undefined for users who cannot sign in. */
export function meFor(slug: string): Schemas["Me"] | undefined {
  const u = userBySlug.get(slug);
  if (!u?.demo_login) return undefined;
  const ref = userRef(slug);
  return {
    ...ref,
    email: u.email,
    company: { id: COMPANY_ID, name: company.name, voen: company.voen },
    permissions: ROLE_PERMISSIONS[ref.role],
  };
}

// Fixtures keep Baku time (+04:00); the API speaks UTC without milliseconds.
export const toUtc = (iso: string) => new Date(iso).toISOString().replace(".000Z", "Z");

type FixturePackage = (typeof packages)[number];

// Latest event that changed the package: creation, uploads, approvals (and invalidations), exports.
function updatedAt(p: FixturePackage): string {
  const times = [
    p.created_at,
    ...p.documents.flatMap((d) => d.versions.map((v) => v.uploaded_at)),
    ...p.approvals.flatMap((a) => [a.created_at, a.invalidated_at ?? a.created_at]),
    ...p.exports.map((e) => e.created_at),
  ].map(toUtc);
  return times.reduce((a, b) => (b > a ? b : a));
}

function toListItem(p: FixturePackage): PackageItem {
  const golden = Object.values(expected.packages).find((e) => e.package_id === p.id);
  if (!golden) throw new Error(`No expected result for ${p.id}`);
  const status = oneOf(STATUSES, golden.status);
  const customer = customers.find((c) => c.id === p.customer_id);
  if (!customer) throw new Error(`Unknown fixture customer: ${p.customer_id}`);
  const extracted = !p.processing;
  return {
    id: mockUuid("package", p.id),
    invoice_number: extracted ? p.invoice_number : null,
    version: p.version,
    status,
    customer: { id: mockUuid("customer", customer.id), name: customer.name },
    invoice_date: extracted ? p.invoice_date : null,
    total: extracted ? { amount: p.invoice.total, currency: oneOf(CURRENCIES, p.currency) } : null,
    po_ref: extracted ? p.invoice.po_ref : null,
    po_unreadable: (p.invoice.unreadable_fields as readonly string[]).includes("po_ref"),
    blocking: golden.blockers.map((b) => ({
      rule_id: b.rule_id,
      outcome: oneOf(["FAIL", "UNKNOWN"], b.outcome),
    })),
    owner: userRef(p.owner_id),
    problem_since: status === "NEEDS_FIX" || status === "NEEDS_REVIEW" ? toUtc(p.created_at) : null,
    updated_at: updatedAt(p),
  };
}

/** Accounts offered by the dev login picker (`demo_login` in the fixtures). */
export const devUsers: Schemas["DevUser"][] = users
  .filter((u) => u.demo_login)
  .map((u) => userRef(u.id));

/** The fixture slug (`u2`) behind a user UUID, if there is one. */
export const userSlug = (id: string) => users.find((u) => mockUuid("user", u.id) === id)?.id;

export const packageList: readonly PackageItem[] = packages.map(toListItem);
