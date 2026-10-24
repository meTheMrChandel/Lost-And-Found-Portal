import unittest
from datetime import datetime, timedelta, timezone

from qr_sandbox.errors import ItemNotFoundError, NotOwnerError, ValidationError
from qr_sandbox.models import Owner
from qr_sandbox.registry import ItemRegistry
from qr_sandbox.tokens import is_valid_token, new_item_token

ALICE = Owner("o-1", "Alice Example", "2026CSM0001", "alice@iitrpr.ac.in", "9000000001")
BOB = Owner("o-2", "Bob Example", "2026CSM0002", "bob@iitrpr.ac.in")


class RegistryTests(unittest.TestCase):
    def setUp(self):
        self.reg = ItemRegistry()

    def test_register_gives_unique_valid_tokens(self):
        a = self.reg.register(ALICE, "Hero bicycle", "bicycle")
        b = self.reg.register(ALICE, "Hero bicycle", "bicycle")
        self.assertNotEqual(a.token, b.token)
        self.assertTrue(is_valid_token(a.token))
        self.assertTrue(a.qr_active)
        self.assertFalse(a.is_marked_lost)

    def test_validation(self):
        with self.assertRaises(ValidationError):
            self.reg.register(ALICE, "   ", "phone")
        with self.assertRaises(ValidationError):
            self.reg.register(ALICE, "x" * 81, "phone")
        with self.assertRaises(ValidationError):
            self.reg.register(ALICE, "Thing", "spaceship")

    def test_get_and_missing(self):
        item = self.reg.register(ALICE, "Laptop", "laptop")
        self.assertIs(self.reg.get(item.token), item)
        with self.assertRaises(ItemNotFoundError):
            self.reg.get(new_item_token())

    def test_token_collision_is_retried(self):
        tokens = iter([new_item_token()] * 2 + [new_item_token()])
        reg = ItemRegistry(token_factory=lambda: next(tokens))
        first = reg.register(ALICE, "One", "other")
        second = reg.register(ALICE, "Two", "other")
        self.assertNotEqual(first.token, second.token)

    def test_only_owner_can_deactivate(self):
        item = self.reg.register(ALICE, "Phone", "phone")
        with self.assertRaises(NotOwnerError):
            self.reg.deactivate_qr(item.token, BOB.owner_id)
        self.reg.deactivate_qr(item.token, ALICE.owner_id)
        self.assertFalse(item.qr_active)
        self.reg.activate_qr(item.token, ALICE.owner_id)
        self.assertTrue(item.qr_active)

    def test_mark_lost_and_found(self):
        item = self.reg.register(ALICE, "Earbuds", "earbuds")
        self.reg.set_lost(item.token, ALICE.owner_id)
        self.assertTrue(item.is_marked_lost)
        self.reg.set_lost(item.token, ALICE.owner_id, lost=False)
        self.assertFalse(item.is_marked_lost)
        with self.assertRaises(NotOwnerError):
            self.reg.set_lost(item.token, BOB.owner_id)

    def test_items_for_owner_is_scoped_and_ordered(self):
        start = datetime(2026, 10, 1, tzinfo=timezone.utc)
        ticks = iter(start + timedelta(minutes=i) for i in range(10))
        reg = ItemRegistry(clock=lambda: next(ticks))
        a1 = reg.register(ALICE, "First", "other")
        reg.register(BOB, "Bob's", "other")
        a2 = reg.register(ALICE, "Second", "other")
        self.assertEqual(reg.items_for_owner(ALICE.owner_id), [a1, a2])


if __name__ == "__main__":
    unittest.main()
