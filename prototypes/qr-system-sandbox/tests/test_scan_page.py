import unittest

from qr_sandbox.errors import QRInactiveError
from qr_sandbox.models import Owner
from qr_sandbox.privacy import leaks_private_data
from qr_sandbox.registry import ItemRegistry
from qr_sandbox.scan_page import LOST_BANNER, build_scan_payload

OWNER = Owner("o-1", "Alice Example", "2026CSM0001", "alice@iitrpr.ac.in", "9000000001")


class ScanPageTests(unittest.TestCase):
    def setUp(self):
        self.reg = ItemRegistry()
        self.item = self.reg.register(OWNER, "Blue bicycle", "bicycle")

    def test_payload_shows_item_and_limited_owner(self):
        payload = build_scan_payload(self.item)
        self.assertEqual(payload["item"]["name"], "Blue bicycle")
        self.assertEqual(payload["owner"]["registration_no"], "2026CSM0001")
        self.assertFalse(leaks_private_data(payload, OWNER))

    def test_message_owner_action_present_and_requires_login(self):
        action = build_scan_payload(self.item)["actions"][0]
        self.assertEqual(action["id"], "message_owner")
        self.assertTrue(action["requires_login"])

    def test_not_lost_has_no_banner(self):
        payload = build_scan_payload(self.item)
        self.assertFalse(payload["highlight_lost"])
        self.assertIsNone(payload["banner"])

    def test_lost_item_is_highlighted(self):
        self.reg.set_lost(self.item.token, OWNER.owner_id)
        payload = build_scan_payload(self.item)
        self.assertTrue(payload["highlight_lost"])
        self.assertEqual(payload["banner"], LOST_BANNER)

    def test_inactive_qr_is_refused(self):
        self.reg.deactivate_qr(self.item.token, OWNER.owner_id)
        with self.assertRaises(QRInactiveError):
            build_scan_payload(self.item)


if __name__ == "__main__":
    unittest.main()
