import unittest

from qr_sandbox.errors import ValidationError
from qr_sandbox.svg import matrix_to_svg


class SvgTests(unittest.TestCase):
    def test_basic_structure_and_size(self):
        svg = matrix_to_svg([[True, False], [False, True]], module_size=5, quiet_zone=1)
        self.assertTrue(svg.startswith("<svg"))
        self.assertIn('viewBox="0 0 4 4"', svg)
        self.assertIn('width="20"', svg)

    def test_runs_are_merged_into_one_segment(self):
        svg = matrix_to_svg([[True, True, True], [False, False, False], [True, False, True]],
                            quiet_zone=0)
        self.assertIn("M0 0h3v1h-3z", svg)
        self.assertIn("M0 2h1v1h-1z", svg)
        self.assertIn("M2 2h1v1h-1z", svg)

    def test_quiet_zone_offsets_modules(self):
        svg = matrix_to_svg([[True]], quiet_zone=4)
        self.assertIn("M4 4h1v1h-1z", svg)

    def test_rejects_empty_and_non_square(self):
        with self.assertRaises(ValidationError):
            matrix_to_svg([])
        with self.assertRaises(ValidationError):
            matrix_to_svg([[True, False]])


if __name__ == "__main__":
    unittest.main()
