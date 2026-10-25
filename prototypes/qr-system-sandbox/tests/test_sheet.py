import unittest

from qr_sandbox.backends import placeholder_matrix
from qr_sandbox.errors import ValidationError
from qr_sandbox.models import Owner
from qr_sandbox.registry import ItemRegistry
from qr_sandbox.sheet import render_sheet
from qr_sandbox.urls import build_scan_url

OWNER = Owner("o-1", "Alice Example", "2026CSM0001", "alice@iitrpr.ac.in", "9000000001")


class SheetTests(unittest.TestCase):
    def setUp(self):
        self.reg = ItemRegistry()
        self.a = self.reg.register(OWNER, "Blue bicycle", "bicycle")
        self.b = self.reg.register(OWNER, "<b>Laptop</b>", "laptop")

    def test_one_label_per_active_item(self):
        html = render_sheet([self.a, self.b])
        self.assertEqual(html.count('class="label"'), 2)

    def test_inactive_items_are_skipped(self):
        self.reg.deactivate_qr(self.b.token, OWNER.owner_id)
        html = render_sheet([self.a, self.b])
        self.assertEqual(html.count('class="label"'), 1)

    def test_names_are_html_escaped(self):
        html = render_sheet([self.b])
        self.assertNotIn("<b>Laptop</b>", html)
        self.assertIn("&lt;b&gt;Laptop&lt;/b&gt;", html)

    def test_no_personal_data_on_the_sheet(self):
        html = render_sheet([self.a, self.b])
        for private in (OWNER.email, OWNER.phone, OWNER.name, OWNER.registration_no):
            self.assertNotIn(private, html)

    def test_provider_receives_the_scan_url(self):
        seen = []

        def spy(data):
            seen.append(data)
            return placeholder_matrix(data)

        render_sheet([self.a], provider=spy)
        self.assertEqual(seen, [build_scan_url(self.a.token)])

    def test_validation(self):
        with self.assertRaises(ValidationError):
            render_sheet([])
        with self.assertRaises(ValidationError):
            render_sheet([self.a], columns=0)

    def test_placeholder_matrix_is_deterministic_and_square(self):
        m1, m2 = placeholder_matrix("x"), placeholder_matrix("x")
        self.assertEqual(m1, m2)
        self.assertEqual(len(m1), 25)
        self.assertTrue(all(len(r) == 25 for r in m1))


if __name__ == "__main__":
    unittest.main()
