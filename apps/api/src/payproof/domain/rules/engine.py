"""Deterministic rule engine: snapshot in, results out. No AI, no I/O."""

from collections.abc import Sequence

from payproof.domain.enums import CheckOutcome
from payproof.domain.rules.r001 import r001
from payproof.domain.rules.r002 import r002
from payproof.domain.rules.r003 import r003
from payproof.domain.rules.r004 import comparable, r004
from payproof.domain.rules.r005 import r005
from payproof.domain.rules.r006 import r006
from payproof.domain.rules.r007 import r007
from payproof.domain.rules.r008 import r008
from payproof.domain.rules.r009 import r009
from payproof.domain.rules.result import CheckResult
from payproof.domain.snapshot import PackageSnapshot

ENGINE_VERSION = "1"  # stored on validation_runs; bump when a rule's behaviour changes

_BLOCKING = (CheckOutcome.FAIL, CheckOutcome.UNKNOWN)


def evaluate(s: PackageSnapshot) -> tuple[CheckResult, ...]:
    """R-001..R-009 in order; R-005/R-006 depend on R-004, R-008 on R-007."""
    r4, r7 = r004(s), r007(s)
    same = comparable(r4)
    return (
        r001(s),
        r002(s),
        r003(s),
        r4,
        r005(s, comparable=same),
        r006(s, comparable=same),
        r7,
        r008(s, r007_result=r7),
        r009(s),
    )


def blockers(checks: Sequence[CheckResult]) -> tuple[CheckResult, ...]:
    """Every FAIL and UNKNOWN blocks approval."""
    return tuple(c for c in checks if c.outcome in _BLOCKING)


def primary_blockers(checks: Sequence[CheckResult]) -> tuple[CheckResult, ...]:
    """Blockers that are problems themselves; cascade results are not counted on dashboards."""
    return tuple(c for c in blockers(checks) if not c.cascade)
