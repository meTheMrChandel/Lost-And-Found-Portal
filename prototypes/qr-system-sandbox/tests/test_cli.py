import io
import os
import tempfile
import unittest

from qr_sandbox.cli import DEMO_OWNER, main


class CliTests(unittest.TestCase):
    def test_demo_prints_url_and_safe_payload(self):
        out = io.StringIO()
        self.assertEqual(main(["demo"], out=out), 0)
        text = out.getvalue()
        self.assertIn("QR encodes: https://lostandfound.iitrpr.ac.in/qr/", text)
        self.assertIn("message_owner", text)
        self.assertNotIn(DEMO_OWNER.email, text)
        self.assertNotIn(DEMO_OWNER.phone, text)

    def test_sheet_writes_html_file(self):
        out = io.StringIO()
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "sheet.html")
            self.assertEqual(main(["sheet", "--out", path, "--columns", "2"], out=out), 0)
            with open(path, encoding="utf-8") as handle:
                html = handle.read()
        self.assertEqual(html.count('class="label"'), 3)
        self.assertIn("wrote", out.getvalue())

    def test_command_is_required(self):
        with self.assertRaises(SystemExit):
            main([], out=io.StringIO())


if __name__ == "__main__":
    unittest.main()
