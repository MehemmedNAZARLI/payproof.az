// Server-side permission matrix — docs/architecture/security.md + ADR-0008 (assignee has none).
import type { Schemas } from "@payproof/api-client";
import type { User } from "./types";

export type Permission = Schemas["Permission"];

const OPERATOR: Permission[] = [
  "VIEW",
  "EDIT_PACKAGE",
  "MANAGE_TASKS",
  "EXPORT_PACKAGE",
  "DELETE_PACKAGE",
];

export const ROLE_PERMISSIONS: Record<User["role"], Permission[]> = {
  operator: OPERATOR,
  approver: [
    "VIEW",
    "EDIT_PACKAGE",
    "MANAGE_TASKS",
    "MANAGE_REQUIREMENTS",
    "APPROVE_PACKAGE",
    "EXPORT_PACKAGE",
  ],
  readonly: ["VIEW"],
  admin: [...OPERATOR, "MANAGE_REQUIREMENTS"],
  assignee: [],
};

export const can = (user: User | undefined, perm: Permission) =>
  !!user && ROLE_PERMISSIONS[user.role].includes(perm);
