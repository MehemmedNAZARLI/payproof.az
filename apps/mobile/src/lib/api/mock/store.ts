import company from "@fixtures/company.json";
import users from "@fixtures/users.json";

import type { Schemas } from "../client";

// shortcut: read-only stand-in for @payproof/mocks (S-06).

type Role = Schemas["Role"];
type Permission = Schemas["Permission"];

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

const userBySlug = new Map(users.map((u) => [u.id, u]));

function userRef(slug: string): Schemas["UserRef"] {
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
