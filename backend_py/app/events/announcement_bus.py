"""Per-tenant announcement event bus.

A lightweight in-process pub/sub used to fan out announcement events from the
POST /announcements endpoint to all active SSE subscribers in the same tenant.

In a multi-worker deployment, this should be backed by Redis pub/sub. For a
single-worker dev / portfolio setup, the in-memory queue below is sufficient
and avoids adding a Redis client to the announcement service.
"""
from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from app.core.logging import get_logger

log = get_logger(__name__)


class AnnouncementBus:
    def __init__(self) -> None:
        # tenant -> list of asyncio.Queue
        self._subs: dict[str, list[asyncio.Queue[dict[str, Any]]]] = defaultdict(list)

    async def subscribe(self, tenant: str) -> asyncio.Queue[dict[str, Any]]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=64)
        self._subs[tenant].append(q)
        log.info("announcement_subscribed", tenant=tenant, total=len(self._subs[tenant]))
        return q

    async def unsubscribe(self, tenant: str, q: asyncio.Queue[dict[str, Any]]) -> None:
        if q in self._subs.get(tenant, []):
            self._subs[tenant].remove(q)
        # Drop the tenant key once its last subscriber leaves, otherwise
        # _subs grows one entry per tenant forever.
        if not self._subs.get(tenant):
            self._subs.pop(tenant, None)
        remaining = len(self._subs.get(tenant, []))
        log.info("announcement_unsubscribed", tenant=tenant, remaining=remaining)

    async def publish(self, tenant: str, event: dict[str, Any]) -> None:
        payload = {**event, "publishedAt": datetime.now(UTC).isoformat()}
        delivered = 0
        dropped = 0
        for q in self._subs.get(tenant, []):
            try:
                q.put_nowait(payload)
                delivered += 1
            except asyncio.QueueFull:
                # Slow SSE consumer: event is lost for them permanently.
                # Count it so operators can see the miss rate.
                dropped += 1
                log.warning("announcement_queue_full", tenant=tenant)
        if dropped:
            from app.observability.metrics import ANNOUNCEMENT_DROPS

            if ANNOUNCEMENT_DROPS is not None:
                ANNOUNCEMENT_DROPS.labels(tenant=tenant).inc(dropped)
        log.info(
            "announcement_published",
            tenant=tenant,
            delivered=delivered,
            dropped=dropped,
            title=payload.get("title"),
        )


bus = AnnouncementBus()


def serialize(payload: dict[str, Any]) -> str:
    """Encode an event payload as JSON for SSE."""
    return json.dumps(payload, default=str)
