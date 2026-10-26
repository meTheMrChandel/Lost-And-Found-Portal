import unittest

from qr_sandbox.directory import OwnerDirectory
from qr_sandbox.models import Owner
from qr_sandbox.privacy import leaks_private_data

PEOPLE = [
    Owner("1", "Alice Kumar", "2026CSM0001", "alice@iitrpr.ac.in", "9000000001"),
    Owner("2", "Bob Alison", "2026CSM0002", "bob@iitrpr.ac.in", "9000000002"),
    Owner("3", "Carol Singh", "2025EEB0100", "carol@iitrpr.ac.in"),
]


class DirectoryTests(unittest.TestCase):
    def setUp(self):
        self.d = OwnerDirectory()
        for p in PEOPLE:
            self.d.add(p)

    def test_exact_registration_number(self):
        res = self.d.search("2026csm0002")
        self.assertEqual([r["owner_id"] for r in res], ["2"])

    def test_registration_prefix(self):
        self.assertEqual({r["owner_id"] for r in self.d.search("2026CSM")}, {"1", "2"})

    def test_name_prefix_ranks_before_substring(self):
        res = self.d.search("ali")
        self.assertEqual([r["owner_id"] for r in res], ["1", "2"])  # Alice, then Bob Alison

    def test_short_or_empty_query_returns_nothing(self):
        self.assertEqual(self.d.search("a"), [])
        self.assertEqual(self.d.search(""), [])
        self.assertEqual(self.d.search(None), [])

    def test_results_never_leak_private_fields(self):
        for owner in PEOPLE:
            self.assertFalse(leaks_private_data(self.d.search("2026"), owner))

    def test_limit(self):
        self.assertEqual(len(self.d.search("2026", limit=1)), 1)


if __name__ == "__main__":
    unittest.main()
