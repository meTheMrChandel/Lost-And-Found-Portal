"""Where the QR module matrix comes from.

Real, scannable codes need an encoder. To keep this sandbox dependency-free the
encoder is pluggable:

* `qrcode_library_provider` uses the optional `qrcode` package (pip install qrcode).
* `placeholder_matrix` makes a deterministic, NOT scannable pattern so the sheet
  layout can be previewed without any dependency.
"""

import hashlib
from typing import Callable, List

from .errors import BackendUnavailableError

Matrix = List[List[bool]]
MatrixProvider = Callable[[str], Matrix]


def qrcode_library_provider(data: str) -> Matrix:
    try:
        import qrcode
        from qrcode.constants import ERROR_CORRECT_M
    except ImportError as exc:
        raise BackendUnavailableError(
            "install the optional 'qrcode' package for scannable codes"
        ) from exc
    qr = qrcode.QRCode(border=0, error_correction=ERROR_CORRECT_M)
    qr.add_data(data)
    qr.make(fit=True)
    return [[bool(cell) for cell in row] for row in qr.get_matrix()]


def placeholder_matrix(data: str, size: int = 25) -> Matrix:
    """Deterministic pseudo pattern with finder-like corners. Not scannable."""
    digest = hashlib.sha256(data.encode()).digest()
    bits = [(digest[i // 8 % len(digest)] >> (i % 8)) & 1 for i in range(size * size)]
    matrix = [[bool(bits[y * size + x]) for x in range(size)] for y in range(size)]

    def finder(ox: int, oy: int) -> None:
        for y in range(7):
            for x in range(7):
                ring = max(abs(x - 3), abs(y - 3))
                matrix[oy + y][ox + x] = ring != 2
    finder(0, 0)
    finder(size - 7, 0)
    finder(0, size - 7)
    return matrix
