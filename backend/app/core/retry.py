"""
Centralized retry policy, transient vs. permanent error classification,
Retry-After header parsing, and safe retry execution utilities.
"""
import logging
import random
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Callable, Optional, TypeVar

from sqlalchemy.exc import DBAPIError, IntegrityError, InterfaceError, OperationalError, ProgrammingError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

T = TypeVar("T")

TRANSIENT_HTTP_STATUS_CODES = frozenset({408, 429, 500, 502, 503, 504})
PERMANENT_HTTP_STATUS_CODES = frozenset({400, 401, 403, 404, 405, 413, 415, 422})

_PERMANENT_OS_ERRORS = (FileNotFoundError, PermissionError, IsADirectoryError, NotADirectoryError)

_TRANSIENT_TEXT_INDICATORS = (
    "rate limit",
    "rate_limited",
    "ratelimit",
    "too many requests",
    "timeout",
    "timed out",
    "temporarily unavailable",
    "service unavailable",
    "bad gateway",
    "gateway timeout",
    "internal server error",
    "connection reset",
    "connection refused",
    "connection aborted",
    "server disconnected",
    "remote end closed",
    "network is unreachable",
    "temporary failure in name resolution",
)

_TRANSIENT_DB_TEXT_INDICATORS = (
    "connection is closed",
    "server closed the connection",
    "terminating connection",
    "could not connect",
    "connection timed out",
    "ssl syscall error",
    "eof detected",
    "deadlock detected",
    "too many clients",
    "connection reset",
    "broken pipe",
    "adminshutdown",
    "cannot connect now",
)


@dataclass(frozen=True)
class RetryPolicy:
    """Bounded exponential-backoff retry configuration."""

    max_retries: int = 2
    initial_delay: float = 0.5
    max_delay: float = 8.0
    backoff_factor: float = 2.0
    jitter: bool = True
    respect_retry_after: bool = True


def extract_status_code(exc: Exception) -> Optional[int]:
    """Extract an HTTP status code from common SDK/HTTP client exceptions."""
    # Check wrapped tenacity exception if present
    if hasattr(exc, "last_attempt"):
        try:
            inner = exc.last_attempt.exception()
            if inner and inner is not exc:
                return extract_status_code(inner)
        except Exception:
            pass

    for attr in ("status_code", "http_status", "status"):
        val = getattr(exc, attr, None)
        if isinstance(val, int) and 100 <= val < 600:
            return val

    response = getattr(exc, "response", None)
    if response is not None:
        for attr in ("status_code", "status"):
            val = getattr(response, attr, None)
            if isinstance(val, int) and 100 <= val < 600:
                return val

    # Some Google/gRPC exceptions expose .code as int or enum with .value
    code = getattr(exc, "code", None)
    if isinstance(code, int) and 100 <= code < 600:
        return code

    return None


def parse_retry_after(exc: Exception, max_delay: float) -> Optional[float]:
    """
    Parse Retry-After header from an HTTP exception response if available.
    Returns delay in seconds clamped to [0.0, max_delay], or None if unavailable.
    """
    headers = None
    response = getattr(exc, "response", None)
    if response is not None:
        headers = getattr(response, "headers", None)
    if headers is None:
        headers = getattr(exc, "headers", None)
    if not headers or not hasattr(headers, "get"):
        return None

    raw_value = headers.get("Retry-After") or headers.get("retry-after")
    if not raw_value:
        return None

    raw_str = str(raw_value).strip()
    try:
        seconds = float(raw_str)
        if seconds >= 0:
            return min(seconds, max_delay)
    except ValueError:
        pass

    try:
        dt = parsedate_to_datetime(raw_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        delta = (dt - datetime.now(timezone.utc)).total_seconds()
        if delta > 0:
            return min(delta, max_delay)
        return 0.0
    except Exception:
        return None


def is_permanent_error(exc: Exception) -> bool:
    """
    Identify permanent errors that must NOT be retried
    (local programming bugs, invalid payloads, auth/validation failures).
    """
    if isinstance(exc, (TypeError, ValueError, KeyError, IndexError, AttributeError, NameError)):
        return True

    if isinstance(exc, _PERMANENT_OS_ERRORS):
        return True

    status_code = extract_status_code(exc)
    if status_code in PERMANENT_HTTP_STATUS_CODES:
        return True

    return False


def is_transient_error(exc: Exception) -> bool:
    """
    Identify transient network, timeout, rate-limit, or 5xx errors safe to retry.
    """
    if is_permanent_error(exc):
        return False

    status_code = extract_status_code(exc)
    if status_code in TRANSIENT_HTTP_STATUS_CODES:
        return True

    if isinstance(exc, (TimeoutError, ConnectionError)):
        return True

    if isinstance(exc, OSError) and not isinstance(exc, _PERMANENT_OS_ERRORS):
        return True

    # Check common HTTP client exception class names without hard-coupling imports
    exc_name = type(exc).__name__.lower()
    if any(
        token in exc_name
        for token in (
            "timeout",
            "connecterror",
            "connectionerror",
            "networkerror",
            "remoteprotocolerror",
            "readerror",
            "writeerror",
            "serviceunavailable",
            "toomanyrequests",
            "ratelimit",
            "internalservererror",
            "badgateway",
            "gatewaytimeout",
        )
    ):
        return True

    error_text = str(exc).lower()
    return any(indicator in error_text for indicator in _TRANSIENT_TEXT_INDICATORS)


def is_transient_db_error(exc: Exception) -> bool:
    """
    Identify transient database connectivity/session errors safe for idempotent read retries.
    Never retries IntegrityError, ProgrammingError, or invalid data errors.
    """
    if isinstance(exc, (IntegrityError, ProgrammingError, ValueError, TypeError)):
        return False

    if isinstance(exc, DBAPIError) and getattr(exc, "connection_invalidated", False):
        return True

    if isinstance(exc, (OperationalError, InterfaceError, TimeoutError, ConnectionError)):
        error_text = str(exc).lower()
        # Exclude obvious SQL syntax / missing table / permission errors
        if any(p in error_text for p in ("syntax error", "does not exist", "no such table", "permission denied")):
            return False
        if any(ind in error_text for ind in _TRANSIENT_DB_TEXT_INDICATORS):
            return True
        # Generic OperationalError/InterfaceError on network DBs (e.g., Neon resume)
        return True

    return False


def compute_retry_delay(attempt: int, policy: RetryPolicy, exc: Optional[Exception] = None) -> float:
    """
    Compute bounded exponential backoff delay with optional jitter and Retry-After respect.
    """
    if exc is not None and policy.respect_retry_after:
        retry_after = parse_retry_after(exc, policy.max_delay)
        if retry_after is not None:
            return retry_after

    exponential = policy.initial_delay * (policy.backoff_factor ** attempt)
    capped = min(policy.max_delay, max(0.0, exponential))

    if policy.jitter and capped > 0:
        # Equal jitter: keeps delay in [0.5 * capped, capped]
        return capped * (0.5 + random.random() * 0.5)

    return capped


def execute_with_retry(
    func: Callable[[], T],
    *,
    policy: RetryPolicy,
    is_retryable: Callable[[Exception], bool] = is_transient_error,
    operation_name: str = "external_operation",
    on_retry: Optional[Callable[[int, Exception, float], None]] = None,
) -> T:
    """
    Execute `func` with bounded retries for transient failures.
    """
    max_attempts = max(1, policy.max_retries + 1)

    for attempt in range(max_attempts):
        try:
            result = func()
            if attempt > 0:
                logger.info(
                    "%s succeeded on retry attempt %d/%d.",
                    operation_name,
                    attempt + 1,
                    max_attempts,
                    extra={
                        "event": "retry_succeeded",
                        "operation": operation_name,
                        "attempt": attempt + 1,
                        "max_attempts": max_attempts,
                    },
                )
            return result
        except Exception as exc:
            is_last_attempt = attempt >= (max_attempts - 1)
            retryable = is_retryable(exc)
            reason = type(exc).__name__

            if is_last_attempt or not retryable:
                if is_last_attempt and attempt > 0 and retryable:
                    logger.warning(
                        "%s exhausted all %d attempts (%s).",
                        operation_name,
                        max_attempts,
                        reason,
                        extra={
                            "event": "retry_exhausted",
                            "operation": operation_name,
                            "attempt": attempt + 1,
                            "max_attempts": max_attempts,
                            "reason": reason,
                        },
                    )
                raise

            retry_after_val = (
                parse_retry_after(exc, policy.max_delay) if policy.respect_retry_after else None
            )
            retry_after_used = retry_after_val is not None
            delay = compute_retry_delay(attempt, policy, exc)

            logger.warning(
                "%s failed transiently (%s) on attempt %d/%d; retrying in %.2fs.",
                operation_name,
                reason,
                attempt + 1,
                max_attempts,
                delay,
                extra={
                    "event": "retry_scheduled",
                    "operation": operation_name,
                    "attempt": attempt + 1,
                    "max_attempts": max_attempts,
                    "reason": reason,
                    "delay_s": round(delay, 3),
                    "retry_after_used": retry_after_used,
                },
            )
            if on_retry is not None:
                on_retry(attempt, exc, delay)

            if delay > 0:
                time.sleep(delay)

    # Unreachable; satisfies static type checkers
    raise RuntimeError(f"{operation_name} exhausted retries unexpectedly.")


def run_db_read_with_retry(
    db: Session,
    operation: Callable[[], T],
    *,
    max_retries: int = 1,
    operation_name: str = "db_read",
) -> T:
    """
    Execute a strictly idempotent read-only DB operation with bounded transient retry.
    Rolls back the session before retrying so the connection/transaction state is clean.
    """
    policy = RetryPolicy(
        max_retries=max(0, max_retries),
        initial_delay=0.2,
        max_delay=2.0,
        jitter=True,
        respect_retry_after=False,
    )

    def _on_retry(_attempt: int, _exc: Exception, _delay: float) -> None:
        try:
            db.rollback()
        except Exception:
            pass

    return execute_with_retry(
        operation,
        policy=policy,
        is_retryable=is_transient_db_error,
        operation_name=operation_name,
        on_retry=_on_retry,
    )
