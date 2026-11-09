"""The single permission matrix (docs/architecture/security.md); the UI mirrors it via /me."""

from enum import StrEnum

from payproof.domain.enums import Role


class Permission(StrEnum):
    VIEW = "VIEW"
    EDIT_PACKAGE = "EDIT_PACKAGE"  # upload, correct extraction, confirm link, record signature
    MANAGE_TASKS = "MANAGE_TASKS"
    MANAGE_REQUIREMENTS = "MANAGE_REQUIREMENTS"  # approve a customer's rule set
    APPROVE_PACKAGE = "APPROVE_PACKAGE"  # approve a ready package
    EXPORT_PACKAGE = "EXPORT_PACKAGE"
    DELETE_PACKAGE = "DELETE_PACKAGE"  # never-approved packages only


_OPERATOR = frozenset(
    {
        Permission.VIEW,
        Permission.EDIT_PACKAGE,
        Permission.MANAGE_TASKS,
        Permission.EXPORT_PACKAGE,
        Permission.DELETE_PACKAGE,
    }
)

ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.OPERATOR: _OPERATOR,
    Role.APPROVER: frozenset(
        {
            Permission.VIEW,
            Permission.EDIT_PACKAGE,
            Permission.MANAGE_TASKS,
            Permission.MANAGE_REQUIREMENTS,
            Permission.APPROVE_PACKAGE,
            Permission.EXPORT_PACKAGE,
        }
    ),
    Role.READONLY: frozenset({Permission.VIEW}),
    # P0: admin manages rules but does not approve packages (four-eyes stays with approvers)
    Role.ADMIN: _OPERATOR | {Permission.MANAGE_REQUIREMENTS},
    Role.ASSIGNEE: frozenset(),  # ADR-0008: task assignee only, cannot sign in
}


def can(role: Role, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS[role]
