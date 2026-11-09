import pytest

from payproof.domain.enums import Role
from payproof.domain.permissions import ROLE_PERMISSIONS, Permission, can
from tests.domain.test_enums import contract_enum

P = Permission
# docs/architecture/security.md, column order: operator, approver, readonly, admin, assignee
MATRIX = {
    P.VIEW: "✓✓✓✓✕",
    P.EDIT_PACKAGE: "✓✓✕✓✕",
    P.MANAGE_TASKS: "✓✓✕✓✕",
    P.MANAGE_REQUIREMENTS: "✕✓✕✓✕",
    P.APPROVE_PACKAGE: "✕✓✕✕✕",  # admin cannot approve in P0
    P.EXPORT_PACKAGE: "✓✓✕✓✕",
    P.DELETE_PACKAGE: "✓✕✕✓✕",
}
ROLES = [Role.OPERATOR, Role.APPROVER, Role.READONLY, Role.ADMIN, Role.ASSIGNEE]


@pytest.mark.parametrize("permission", list(Permission))
@pytest.mark.parametrize("role", ROLES)
def test_matrix_matches_security_doc(role: Role, permission: Permission) -> None:
    expected = MATRIX[permission][ROLES.index(role)] == "✓"
    assert can(role, permission) is expected


def test_every_role_has_an_entry() -> None:
    assert set(ROLE_PERMISSIONS) == set(Role)


def test_assignee_has_no_permissions() -> None:
    assert ROLE_PERMISSIONS[Role.ASSIGNEE] == frozenset()  # ADR-0008: cannot sign in


def test_permissions_match_contract() -> None:
    assert [p.value for p in Permission] == contract_enum("Permission")
