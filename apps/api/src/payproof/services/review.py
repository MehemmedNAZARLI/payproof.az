"""Manual re-validation and signature review. Neither changes a document, a critical field
or the order link, so neither bumps the package version (CLAUDE.md invariant)."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import Conflict, InvalidInput, PackageNotReady
from payproof.repositories import package_reads as reads
from payproof.repositories.models import InvoicePackage
from payproof.services.audit import record
from payproof.services.linking import locked_package
from payproof.services.validation import revalidate


async def _current(
    session: AsyncSession, package_id: uuid.UUID, expected_version: int
) -> InvoicePackage:
    pkg = await locked_package(session, package_id)
    if pkg.processing:
        raise PackageNotReady(details={"status": "PROCESSING"})
    if expected_version != pkg.version:
        raise Conflict(
            f"Paket v{pkg.version}-ə yenilənib; səhifəni yeniləyin.",
            {"current_version": pkg.version, "expected_version": expected_version},
        )
    return pkg


async def validate_now(
    session: AsyncSession, *, actor_id: uuid.UUID, package_id: uuid.UUID, expected_version: int
) -> None:
    pkg = await _current(session, package_id, expected_version)
    await revalidate(session, pkg, actor_id)
    await session.commit()


async def review_signature(
    session: AsyncSession, *, actor_id: uuid.UUID, package_id: uuid.UUID, expected_version: int
) -> None:
    """A person saw the signature on the current delivery note — visual presence only, not
    legal authentication. Reviewing again changes nothing; a new delivery version resets it."""
    pkg = await _current(session, package_id, expected_version)
    if pkg.signature_reviewed_by is not None:
        return
    note = await reads.latest_delivery(session, pkg.id)
    if note is None:
        raise InvalidInput("Paketdə təhvil sənədi yoxdur.", {"fields": {"delivery": "yoxdur"}})
    pkg.signature_reviewed_by = actor_id
    await record(
        session,
        actor_id=actor_id,
        action="signature.reviewed",
        message=f"{note.note_number or 'Təhvil sənədi'}: imzanın vizual mövcudluğu "
        "təsdiqləndi (hüquqi autentifikasiya deyil)",
        object_type="delivery_note",
        object_id=note.id,
        package=pkg,
    )
    await revalidate(session, pkg)
    await session.commit()
