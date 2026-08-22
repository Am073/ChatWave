"""Prometheus metrics: lightweight in-process counters/histograms.

Exposed at /metrics (and /api/metrics behind the same router) for scraping.
Uses prometheus_client (already common infra). Falls back to a no-op
implementation if the library is missing at import time.
"""
from __future__ import annotations

import re
import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

try:
    from prometheus_client import (
        CONTENT_TYPE_LATEST,
        CollectorRegistry,
        Counter,
        Histogram,
        generate_latest,
    )

    PROMETHEUS_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    PROMETHEUS_AVAILABLE = False

from app.core.logging import get_logger

log = get_logger(__name__)


if PROMETHEUS_AVAILABLE:
    REGISTRY = CollectorRegistry()
    HTTP_REQUESTS_TOTAL = Counter(
        "http_requests_total",
        "Total HTTP requests",
        labelnames=("method", "path", "status"),
        registry=REGISTRY,
    )
    HTTP_REQUEST_DURATION = Histogram(
        "http_request_duration_seconds",
        "HTTP request latency in seconds",
        labelnames=("method", "path"),
        buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
        registry=REGISTRY,
    )
    CHATLOG_INSERT_FAILURES = Counter(
        "chatlog_insert_failures_total",
        "ChatLog persistence failures (Mongo unreachable or write error)",
        labelnames=("tenant",),
        registry=REGISTRY,
    )
    ANNOUNCEMENT_DROPS = Counter(
        "announcement_drops_total",
        "Announcement events dropped for slow SSE subscribers",
        labelnames=("tenant",),
        registry=REGISTRY,
    )
else:
    REGISTRY = None
    HTTP_REQUESTS_TOTAL = None
    HTTP_REQUEST_DURATION = None
    CHATLOG_INSERT_FAILURES = None
    ANNOUNCEMENT_DROPS = None


class PrometheusMiddleware(BaseHTTPMiddleware):
    """Record request count + latency. Bypass the metrics endpoint itself."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if not PROMETHEUS_AVAILABLE or request.url.path.endswith("/metrics"):
            return await call_next(request)
        start = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            # try/finally so failed requests are counted and timed too.
            elapsed = time.perf_counter() - start
            # Normalize path so we don't blow up label cardinality.
            path = self._normalize_path(request.url.path)
            try:
                HTTP_REQUESTS_TOTAL.labels(
                    method=request.method, path=path, status=status_code
                ).inc()
                HTTP_REQUEST_DURATION.labels(method=request.method, path=path).observe(
                    elapsed
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("metrics_record_failed", error=str(exc))

    @staticmethod
    def _normalize_path(path: str) -> str:
        """Collapse id-like path segments into {id} to cap label cardinality.

        Covers dashed UUIDs (8-4-4-4-12 hex), bare hex ids >=16 chars,
        Mongo ObjectIds (24 hex), and plain numeric segments. Any other
        segment is left as-is; route authors should avoid free-text paths.
        """
        path = re.sub(
            r"/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
            r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?=/|$)",
            "/{id}",
            path,
        )
        path = re.sub(r"/[0-9a-fA-F]{16,}(?=/|$)", "/{id}", path)
        path = re.sub(r"/\d+(?=/|$)", "/{id}", path)
        return path


def render_metrics() -> tuple[bytes, str]:
    if not PROMETHEUS_AVAILABLE:
        return b'# prometheus_client not installed\n', "text/plain; version=0.0.4"
    return generate_latest(REGISTRY), CONTENT_TYPE_LATEST
