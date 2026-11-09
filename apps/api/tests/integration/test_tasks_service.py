import datetime as dt

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.core.errors import InvalidInput
from payproof.repositories.base import bind_tenant
from payproof.seed.cli import seed
from payproof.seed.fixtures import uid
from payproof.seed.identity import COMPANY_ID
from payproof.services.tasks import NewTask, TaskAlreadyOpen, create_task, today


def _new(rule: str = "R-007", days: int = 2) -> NewTask:
    return NewTask(rule, uid("u3"), "Təhvil aktını yükləyin", today() + dt.timedelta(days=days))


async def test_one_open_task_per_rule_and_no_past_due_date(db: AsyncSession) -> None:
    await seed(db)
    bind_tenant(db, COMPANY_ID)
    task = await create_task(db, actor_id=uid("u1"), package_id=uid("pkg_1042"), new=_new())
    assert (task.number, task.status) == ("T-124", "OPEN")  # after the seeded T-123
    with pytest.raises(TaskAlreadyOpen):
        await create_task(db, actor_id=uid("u1"), package_id=uid("pkg_1042"), new=_new())
    with pytest.raises(InvalidInput, match="keçmişdə"):
        await create_task(
            db, actor_id=uid("u1"), package_id=uid("pkg_1042"), new=_new("R-001", days=-1)
        )
