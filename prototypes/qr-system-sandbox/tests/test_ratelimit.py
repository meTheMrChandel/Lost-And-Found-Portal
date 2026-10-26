import unittest

from qr_sandbox.errors import RateLimitExceeded
from qr_sandbox.ratelimit import ScanRateLimiter


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


class RateLimitTests(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.limiter = ScanRateLimiter(max_scans=3, window_seconds=10, clock=self.clock)

    def test_allows_up_to_the_limit(self):
        for _ in range(3):
            self.limiter.check("1.2.3.4")

    def test_blocks_after_the_limit_with_retry_after(self):
        for _ in range(3):
            self.limiter.check("1.2.3.4")
        self.clock.now += 4
        with self.assertRaises(RateLimitExceeded) as ctx:
            self.limiter.check("1.2.3.4")
        self.assertAlmostEqual(ctx.exception.retry_after, 6.0)

    def test_window_slides(self):
        for _ in range(3):
            self.limiter.check("k")
        self.clock.now += 10
        self.limiter.check("k")  # old hits expired

    def test_keys_are_independent(self):
        for _ in range(3):
            self.limiter.check("a")
        self.limiter.check("b")

    def test_invalid_config(self):
        with self.assertRaises(ValueError):
            ScanRateLimiter(max_scans=0)


if __name__ == "__main__":
    unittest.main()
