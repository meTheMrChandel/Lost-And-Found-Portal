"""Sliding-window rate limiter for public scan pages (NFR-3)."""

import time
from collections import defaultdict, deque
from typing import Callable, Deque, Dict

from .errors import RateLimitExceeded


class ScanRateLimiter:
    """Allow at most `max_scans` per `window_seconds` for each key (e.g. an IP)."""

    def __init__(
        self,
        max_scans: int = 30,
        window_seconds: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
    ):
        if max_scans < 1 or window_seconds <= 0:
            raise ValueError("max_scans must be >= 1 and window_seconds > 0")
        self.max_scans = max_scans
        self.window = window_seconds
        self._clock = clock
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = self._clock()
        hits = self._hits[key]
        while hits and now - hits[0] >= self.window:
            hits.popleft()
        if len(hits) >= self.max_scans:
            raise RateLimitExceeded(self.window - (now - hits[0]))
        hits.append(now)
