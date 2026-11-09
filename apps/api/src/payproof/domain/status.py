"""Package status (R-010): derived from the latest run, approvals and exports — never stored."""

from collections.abc import Sequence

from payproof.domain.enums import CheckOutcome, PackageStatus
from payproof.domain.rules.engine import blockers
from payproof.domain.rules.result import CheckResult


def derive_status(
    *,
    processing: bool,
    link_confirmed: bool,
    checks: Sequence[CheckResult],
    approved: bool,
    exported: bool,
) -> PackageStatus:
    """`approved`: a valid approval exists for the current version under the rule set in force.
    `exported`: the current version has been exported. Any blocker wins over both."""
    if processing:
        return PackageStatus.PROCESSING
    if not link_confirmed:
        return PackageStatus.NEEDS_REVIEW
    if any(c.outcome is CheckOutcome.FAIL for c in checks):
        return PackageStatus.NEEDS_FIX
    if not checks or blockers(checks):  # UNKNOWN or no run yet is never READY_FOR_APPROVAL
        return PackageStatus.NEEDS_REVIEW
    if approved:
        return PackageStatus.EXPORTED if exported else PackageStatus.APPROVED_READY
    return PackageStatus.READY_FOR_APPROVAL
