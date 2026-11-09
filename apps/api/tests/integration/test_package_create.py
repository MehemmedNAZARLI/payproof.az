"""Golden: the demo sets of fixtures/newsets.json become packages with the expected status."""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from payproof.extraction.mock import MockExtractionAdapter
from payproof.extraction.pipeline import adapter_extractor
from payproof.repositories.base import bind_tenant
from payproof.seed.cli import seed
from payproof.seed.files import placeholder
from payproof.seed.fixtures import EXPECTED, load, uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.package_create import DuplicateInvoice, NewFile, create_package
from payproof.services.package_query import load_states
from payproof.storage.s3 import get_storage
from payproof.worker.create import create_handler
from payproof.worker.queue import PostgresQueue
from payproof.worker.runner import run_once

TYPES = ("invoice", "order", "delivery")


def _uploads(files: list[str]) -> list[NewFile]:
    """Files in the set's order: invoice, order, then delivery when present."""
    kinds = [t for t in TYPES if t != "delivery" or len(files) == 3]
    return [
        NewFile(t, name, placeholder(name) + uuid.uuid4().bytes)
        for t, name in zip(kinds, files, strict=True)
    ]


async def _create(db: AsyncSession, n: dict[str, object]) -> uuid.UUID:
    _, body = await create_package(
        db, get_storage(), actor_id=uid("u1"), customer_id=uid(str(n["customer_id"])),
        owner_id=uid("u1"), uploads=_uploads(list(n["files"])), key=uuid.uuid4(),  # type: ignore[call-overload]
    )  # fmt: skip
    return uuid.UUID(body["package_id"])


@pytest.mark.parametrize("n", load("newsets.json"), ids=lambda n: n["invoice_number"])
async def test_demo_set_becomes_the_expected_package(
    db: AsyncSession, n: dict[str, object]
) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    pid = await _create(db, n)
    [before] = await load_states(db, [pid])
    assert before.status.value == "PROCESSING"
    sessions = async_sessionmaker(
        bind=await db.connection(), join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    handler = create_handler(adapter_extractor(MockExtractionAdapter(), get_storage()))
    assert await run_once(sessions, PostgresQueue(), {"create_package": handler})
    db.expire_all()
    [after] = await load_states(db, [pid])
    expected = EXPECTED["newsets"][n["invoice_number"]]
    blockers = [{"rule_id": b.rule_id, "outcome": b.outcome.value} for b in after.blockers]
    assert (after.status.value, blockers) == (expected["status"], expected["blockers"])
    assert after.package.link_method == "exact_id"  # PO-399 / PO-400 of the same customer

    with pytest.raises(DuplicateInvoice):
        await _create(db, n)
