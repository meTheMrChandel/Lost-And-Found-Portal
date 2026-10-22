import unittest

from qr_sandbox.errors import InvalidScanUrlError, InvalidTokenError
from qr_sandbox.tokens import new_item_token
from qr_sandbox.urls import build_scan_url, parse_scan_url

BASE = "https://lostandfound.iitrpr.ac.in"


class UrlTests(unittest.TestCase):
    def test_round_trip(self):
        token = new_item_token()
        self.assertEqual(parse_scan_url(build_scan_url(token)), token)

    def test_url_contains_only_the_uuid(self):
        token = new_item_token()
        self.assertEqual(build_scan_url(token), f"{BASE}/qr/{token}")

    def test_base_url_trailing_slash_is_ignored(self):
        token = new_item_token()
        self.assertEqual(build_scan_url(token, BASE + "/"), f"{BASE}/qr/{token}")

    def test_build_rejects_invalid_token(self):
        with self.assertRaises(InvalidTokenError):
            build_scan_url("abc")

    def test_parse_rejects_other_host(self):
        token = new_item_token()
        with self.assertRaises(InvalidScanUrlError):
            parse_scan_url(f"https://evil.example.com/qr/{token}")

    def test_parse_rejects_other_path(self):
        token = new_item_token()
        with self.assertRaises(InvalidScanUrlError):
            parse_scan_url(f"{BASE}/items/{token}")

    def test_parse_rejects_bad_token(self):
        with self.assertRaises(InvalidScanUrlError):
            parse_scan_url(f"{BASE}/qr/12345")

    def test_parse_accepts_trailing_slash_and_query(self):
        token = new_item_token()
        self.assertEqual(parse_scan_url(f"{BASE}/qr/{token}/?src=print"), token)


if __name__ == "__main__":
    unittest.main()
