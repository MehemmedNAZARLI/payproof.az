from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from payproof.api import (
    approval,
    audit,
    auth,
    customers,
    demo,
    documents,
    events,
    export,
    health,
    jobs,
    notifications,
    package_writes,
    packages,
    review,
    tasks,
)
from payproof.api.ratelimit import body_limit_middleware
from payproof.core.errors import register_error_handlers
from payproof.core.logging import configure_logging, correlation_id_middleware
from payproof.core.settings import Settings, get_settings
from payproof.realtime.hub import Hub


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    hub: Hub = app.state.hub
    await hub.start()  # this process's one LISTEN connection
    yield
    await hub.stop()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    app = FastAPI(title="PayProof API", version="0.1.0", lifespan=_lifespan)
    app.state.hub = Hub(settings.database_url)
    app.middleware("http")(body_limit_middleware)  # inner: still gets a correlation id
    app.middleware("http")(correlation_id_middleware)
    # added last = outermost: preflights are answered before auth and logging
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,  # the token travels in Authorization, never in a cookie
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "Last-Event-ID"],
    )
    register_error_handlers(app)
    app.include_router(health.router, prefix="/v1")
    if settings.env == "dev":  # demo login does not exist outside dev, not even as a 403
        app.include_router(auth.dev_router, prefix="/v1")
        app.include_router(demo.dev_router, prefix="/v1")
    app.include_router(auth.router, prefix="/v1")
    app.include_router(packages.router, prefix="/v1")
    app.include_router(audit.router, prefix="/v1")
    app.include_router(documents.router, prefix="/v1")
    app.include_router(jobs.router, prefix="/v1")
    app.include_router(review.router, prefix="/v1")
    app.include_router(tasks.router, prefix="/v1")
    app.include_router(approval.router, prefix="/v1")
    app.include_router(export.router, prefix="/v1")
    app.include_router(customers.router, prefix="/v1")
    app.include_router(notifications.router, prefix="/v1")
    app.include_router(package_writes.router, prefix="/v1")
    app.include_router(events.router, prefix="/v1")
    return app


def run() -> None:
    s = get_settings()
    dev = s.env == "dev" and s.api_reload
    # log_config=None keeps our JSON root handler instead of uvicorn's defaults
    # access_log=False: uvicorn's line has the query string and no correlation id; ours has neither
    # problem (core/logging.py)
    uvicorn.run(
        "payproof.main:create_app",
        factory=True,
        host=s.api_host,
        port=8000,
        reload=dev,
        log_config=None,
        access_log=False,
    )
