# API and worker image — build from the repo root (the seed reads ../../fixtures):
#   docker compose build api worker
# Targets: `api` (migrates, then serves :8000) and `worker` (processes jobs).
FROM ghcr.io/astral-sh/uv:0.13.7 AS uv

FROM python:3.12-slim AS base
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PYTHONUNBUFFERED=1
WORKDIR /app/apps/api
# dependencies first: this layer is reused until uv.lock changes
# (uv's download cache is a build cache mount, never part of the image)
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev --no-install-project
COPY apps/api/ ./
COPY fixtures/ /app/fixtures/
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev
ENV PATH=/app/.venv/bin:$PATH \
    API_HOST=0.0.0.0 \
    API_RELOAD=false
RUN useradd --uid 10001 --no-create-home payproof && chown -R payproof /app
USER payproof

FROM base AS api
EXPOSE 8000
HEALTHCHECK --interval=5s --timeout=3s --retries=20 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/v1/health')"
CMD ["sh", "-c", "alembic upgrade head && exec payproof-api"]

FROM base AS worker
CMD ["payproof-worker"]
