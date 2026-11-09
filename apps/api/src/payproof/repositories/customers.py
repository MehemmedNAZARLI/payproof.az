import uuid

from payproof.repositories.base import BaseRepository
from payproof.repositories.models import Customer, RequirementSet


class CustomerRepository(BaseRepository[Customer]):
    model = Customer


class RequirementSetRepository(BaseRepository[RequirementSet]):
    model = RequirementSet

    async def latest(self, customer_id: uuid.UUID) -> RequirementSet | None:
        """Current rules = highest version (ADR-0009)."""
        stmt = (
            self._select()
            .where(RequirementSet.customer_id == customer_id)
            .order_by(RequirementSet.version.desc())
            .limit(1)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()
