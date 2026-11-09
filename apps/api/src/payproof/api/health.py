from fastapi import APIRouter

router = APIRouter()


# Ops probe, not part of packages/contracts/openapi.yaml, so hidden from the schema.
@router.get("/health", include_in_schema=False)
def health() -> dict[str, str]:
    return {"status": "ok"}
