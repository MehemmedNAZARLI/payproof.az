"""Reads behind one package's detail screen (the session is tenant-bound)."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.repositories.models import (
    ApprovalRecord,
    Document,
    DocumentVersion,
    ExportRecord,
    ExtractedField,
    OrderLine,
    RequirementSet,
    ResolutionTask,
)


async def documents(
    session: AsyncSession, package_id: uuid.UUID
) -> list[tuple[Document, list[DocumentVersion]]]:
    """Documents with their versions, newest version first."""
    docs = (await session.scalars(select(Document).where(Document.package_id == package_id))).all()
    versions = (
        await session.scalars(
            select(DocumentVersion)
            .where(DocumentVersion.document_id.in_([d.id for d in docs]))
            .order_by(DocumentVersion.version_no.desc())
        )
    ).all()
    order = {"invoice": 0, "order": 1, "delivery": 2}
    return [
        (d, [v for v in versions if v.document_id == d.id])
        for d in sorted(docs, key=lambda d: order.get(d.type, 9))
    ]


async def fields(session: AsyncSession, document_version_id: uuid.UUID) -> list[ExtractedField]:
    q = select(ExtractedField).where(ExtractedField.document_version_id == document_version_id)
    return list((await session.scalars(q)).all())


async def descriptions(session: AsyncSession, order_id: uuid.UUID) -> dict[str, str]:
    """Product descriptions known from the confirmed order's lines."""
    q = select(OrderLine.product_code, OrderLine.description).where(OrderLine.order_id == order_id)
    return {code: desc for code, desc in (await session.execute(q)).all() if desc}


async def rule_set_versions(session: AsyncSession, ids: set[uuid.UUID]) -> dict[uuid.UUID, int]:
    q = select(RequirementSet.id, RequirementSet.version).where(RequirementSet.id.in_(ids))
    return {rs_id: version for rs_id, version in (await session.execute(q)).all()}


async def approvals(session: AsyncSession, package_id: uuid.UUID) -> list[ApprovalRecord]:
    q = (
        select(ApprovalRecord)
        .where(ApprovalRecord.package_id == package_id)
        .order_by(ApprovalRecord.created_at)
    )
    return list((await session.scalars(q)).all())


async def exports(session: AsyncSession, package_id: uuid.UUID) -> list[ExportRecord]:
    q = (
        select(ExportRecord)
        .where(ExportRecord.package_id == package_id)
        .order_by(ExportRecord.created_at)
    )
    return list((await session.scalars(q)).all())


async def tasks(session: AsyncSession, package_id: uuid.UUID) -> list[ResolutionTask]:
    q = (
        select(ResolutionTask)
        .where(ResolutionTask.package_id == package_id, ResolutionTask.deleted_at.is_(None))
        .order_by(ResolutionTask.created_at)
    )
    return list((await session.scalars(q)).all())
