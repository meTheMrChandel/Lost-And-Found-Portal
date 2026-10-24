import unittest

from qr_sandbox.models import Owner
from qr_sandbox.privacy import leaks_private_data, public_owner_view

OWNER = Owner("o-1", "Alice Example", "2026CSM0001", "alice@iitrpr.ac.in", "9000000001")


class PrivacyTests(unittest.TestCase):
    def test_public_view_has_only_name_and_registration_number(self):
        self.assertEqual(
            public_owner_view(OWNER),
            {"name": "Alice Example", "registration_no": "2026CSM0001"},
        )

    def test_public_view_never_leaks(self):
        self.assertFalse(leaks_private_data(public_owner_view(OWNER), OWNER))

    def test_leak_detector_finds_email_and_phone(self):
        self.assertTrue(leaks_private_data({"x": "alice@iitrpr.ac.in"}, OWNER))
        self.assertTrue(leaks_private_data({"deep": {"y": ["9000000001"]}}, OWNER))

    def test_owner_without_phone_is_fine(self):
        owner = Owner("o-2", "Bob", "2026CSM0002", "bob@iitrpr.ac.in")
        self.assertFalse(leaks_private_data({"name": "Bob"}, owner))


if __name__ == "__main__":
    unittest.main()
