"""Render a boolean module matrix as a compact SVG (FR-QR-3)."""

from typing import List, Sequence

from .errors import ValidationError


def _check_matrix(matrix: Sequence[Sequence[bool]]) -> int:
    size = len(matrix)
    if size == 0:
        raise ValidationError("matrix is empty")
    if any(len(row) != size for row in matrix):
        raise ValidationError("matrix must be square")
    return size


def _row_runs(row: Sequence[bool]) -> List[tuple]:
    """(start, length) of every run of dark modules in a row."""
    runs, start = [], None
    for x, dark in enumerate(row):
        if dark and start is None:
            start = x
        elif not dark and start is not None:
            runs.append((start, x - start))
            start = None
    if start is not None:
        runs.append((start, len(row) - start))
    return runs


def matrix_to_svg(
    matrix: Sequence[Sequence[bool]],
    module_size: int = 4,
    quiet_zone: int = 4,
    dark: str = "#000000",
    light: str = "#ffffff",
) -> str:
    size = _check_matrix(matrix)
    total = size + 2 * quiet_zone
    commands = []
    for y, row in enumerate(matrix):
        for start, length in _row_runs(row):
            commands.append(f"M{start + quiet_zone} {y + quiet_zone}h{length}v1h-{length}z")
    px = total * module_size
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} {total}" '
        f'width="{px}" height="{px}" shape-rendering="crispEdges" role="img" '
        f'aria-label="QR code">'
        f'<rect width="{total}" height="{total}" fill="{light}"/>'
        f'<path d="{"".join(commands)}" fill="{dark}"/></svg>'
    )
