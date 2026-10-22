import unittest

from qr_sandbox.errors import InvalidTokenError
from qr_sandbox.tokens import is_valid_token, new_item_token, normalize_token


class TokenTests(unittest.TestCase):
    def test_new_tokens_are_valid_and_unique(self):
        tokens = {new_item_token() for _ in range(500)}
        self.assertEqual(len(tokens), 500)
        self.assertTrue(all(is_valid_token(t) for t in tokens))

    def test_rejects_non_strings_and_garbage(self):
        for bad in (None, 123, "", "hello", "1234", b"bytes"):
            self.assertFalse(is_valid_token(bad), bad)

    def test_rejects_non_v4_uuid(self):
        self.assertFalse(is_valid_token("6ba7b810-9dad-11d1-80b4-00c04fd430c8"))  # v1

    def test_rejects_non_canonical_forms(self):
        token = new_item_token()
        self.assertFalse(is_valid_token(token.replace("-", "")))
        self.assertFalse(is_valid_token("{" + token + "}"))

    def test_normalize_lowercases(self):
        token = new_item_token()
        self.assertEqual(normalize_token(token.upper()), token)

    def test_normalize_raises_on_invalid(self):
        with self.assertRaises(InvalidTokenError):
            normalize_token("not-a-token")


if __name__ == "__main__":
    unittest.main()
