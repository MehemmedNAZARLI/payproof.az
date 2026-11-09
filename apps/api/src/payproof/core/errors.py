from collections.abc import Mapping
from enum import StrEnum
from typing import Any, ClassVar, cast

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException


class ErrorCode(StrEnum):
    """Mirror of `ErrorCode` in packages/contracts/openapi.yaml (checked by a test)."""

    VALIDATION_ERROR = "VALIDATION_ERROR"
    TASK_STATUS_NOT_ALLOWED = "TASK_STATUS_NOT_ALLOWED"
    INVOICE_REQUIRED = "INVOICE_REQUIRED"
    IDEMPOTENCY_KEY_REUSED = "IDEMPOTENCY_KEY_REUSED"
    UNAUTHENTICATED = "UNAUTHENTICATED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    VERSION_CONFLICT = "VERSION_CONFLICT"
    PACKAGE_NOT_READY = "PACKAGE_NOT_READY"
    PACKAGE_NOT_DELETABLE = "PACKAGE_NOT_DELETABLE"
    TASK_ALREADY_OPEN = "TASK_ALREADY_OPEN"
    DUPLICATE_FILE = "DUPLICATE_FILE"
    DUPLICATE_INVOICE = "DUPLICATE_INVOICE"
    IDEMPOTENCY_IN_PROGRESS = "IDEMPOTENCY_IN_PROGRESS"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    UNSUPPORTED_FILE_TYPE = "UNSUPPORTED_FILE_TYPE"
    RATE_LIMITED = "RATE_LIMITED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class DomainError(Exception):
    """Base for expected errors; subclasses set status, code and an Azerbaijani UI message."""

    status_code: ClassVar[int] = 400
    code: ClassVar[ErrorCode] = ErrorCode.VALIDATION_ERROR
    message: str = "Sorğu yanlışdır."

    def __init__(self, message: str | None = None, details: dict[str, Any] | None = None):
        self.message = message or self.message
        self.details = details or {}
        super().__init__(self.message)


class InvalidInput(DomainError):
    """Well-formed request with invalid values (422); `details.fields` names the culprits."""

    status_code = 422
    code = ErrorCode.VALIDATION_ERROR
    message = "Daxil edilən məlumat yanlışdır."


class Unauthenticated(DomainError):
    status_code = 401
    code = ErrorCode.UNAUTHENTICATED
    message = "Sessiya bitib. Yenidən daxil olun."  # openapi Unauthenticated example


class Forbidden(DomainError):
    status_code = 403
    code = ErrorCode.FORBIDDEN
    message = "Bu əməliyyat üçün icazəniz yoxdur."


class NotFound(DomainError):
    status_code = 404
    code = ErrorCode.NOT_FOUND
    message = "Tapılmadı."


class Conflict(DomainError):
    """409: stale `expected_version`, a duplicate, a busy package or key."""

    status_code = 409
    code = ErrorCode.VERSION_CONFLICT
    message = "Paket yenilənib; səhifəni yeniləyin."


class DuplicateFile(Conflict):
    code = ErrorCode.DUPLICATE_FILE


class PackageNotReady(Conflict):
    code = ErrorCode.PACKAGE_NOT_READY
    message = "Paket hələ emal olunur — bir az sonra yenidən cəhd edin."


class IdempotencyKeyReused(DomainError):
    status_code = 422
    code = ErrorCode.IDEMPOTENCY_KEY_REUSED
    message = "Eyni sorğu fərqli məlumatla təkrarlandı."


class FileTooLarge(DomainError):
    status_code = 413
    code = ErrorCode.FILE_TOO_LARGE
    message = "Fayl 20 MB-dan böyükdür."


class UnsupportedFileType(DomainError):
    status_code = 415
    code = ErrorCode.UNSUPPORTED_FILE_TYPE
    message = "Yalnız PDF, PNG, JPEG, CSV və XLSX qəbul olunur."


_HTTP_DEFAULTS: dict[int, type[DomainError]] = {401: Unauthenticated, 403: Forbidden, 404: NotFound}


def error_response(
    status: int,
    code: ErrorCode,
    message: str,
    details: dict[str, Any] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    body = {"error": {"code": code, "message": message, "details": details or {}}}
    return JSONResponse(body, status_code=status, headers=headers)


async def _domain(_: Request, exc: Exception) -> JSONResponse:
    err = cast(DomainError, exc)
    headers = getattr(err, "headers", None)  # e.g. Retry-After of a 429
    return error_response(err.status_code, err.code, err.message, err.details, headers)


async def _validation(_: Request, exc: Exception) -> JSONResponse:
    errors = cast(RequestValidationError, exc).errors()
    # only loc + type: input values may contain document text
    fields = [{"loc": list(e["loc"]), "type": e["type"]} for e in errors]
    return error_response(400, ErrorCode.VALIDATION_ERROR, "Sorğu yanlışdır.", {"fields": fields})


async def _http(_: Request, exc: Exception) -> JSONResponse:
    http = cast(HTTPException, exc)
    known = _HTTP_DEFAULTS.get(http.status_code)
    # shortcut: other framework 4xx (405...) -> VALIDATION_ERROR; new codes need /contract-change
    code, message = (
        (known.code, known.message) if known else (ErrorCode.VALIDATION_ERROR, "Sorğu yanlışdır.")
    )
    return error_response(http.status_code, code, message, headers=http.headers)


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, _domain)
    app.add_exception_handler(RequestValidationError, _validation)
    app.add_exception_handler(HTTPException, _http)
