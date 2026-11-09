"""`POST /v1/demo/reset` — back to the fixtures dataset. Mounted only with ENV=dev (main.py)."""

from fastapi import APIRouter, Response

from payproof.api.deps import CurrentMember, Session
from payproof.seed.cli import reset, seed
from payproof.seed.files import store_demo_files
from payproof.storage.s3 import get_storage

dev_router = APIRouter(tags=["demo"])


@dev_router.post("/demo/reset", status_code=204)
async def reset_demo(session: Session, _: CurrentMember) -> Response:
    """Whole database: dev holds only the demo company."""
    await reset(session)
    await seed(session)
    await store_demo_files(session, get_storage())
    await session.commit()
    return Response(status_code=204)
