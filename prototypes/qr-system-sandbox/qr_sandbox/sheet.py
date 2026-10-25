"""Printable QR sheet (FR-QR-3). Labels carry no personal data (FR-QR-2)."""

from html import escape
from typing import Iterable

from .backends import MatrixProvider, placeholder_matrix
from .constants import DEFAULT_BASE_URL
from .errors import ValidationError
from .models import Item
from .svg import matrix_to_svg
from .urls import build_scan_url

_STYLE = (
    "body{font-family:system-ui,sans-serif;margin:16px}"
    "h1{font-size:18px}"
    ".grid{display:grid;gap:0}"
    ".label{margin:0;padding:10px;border:1px dashed #888;text-align:center;"
    "break-inside:avoid}"
    ".label svg{width:100%;height:auto;max-width:180px}"
    ".label figcaption{display:flex;flex-direction:column;gap:2px;font-size:12px}"
    ".label small{color:#555}"
    "@media print{h1{display:none}body{margin:0}}"
)


def render_sheet(
    items: Iterable[Item],
    base_url: str = DEFAULT_BASE_URL,
    provider: MatrixProvider = placeholder_matrix,
    columns: int = 3,
    title: str = "Lost & Found QR tags",
) -> str:
    """Return a standalone HTML page with one label per active item."""
    if columns < 1:
        raise ValidationError("columns must be at least 1")
    active = [i for i in items if i.qr_active]
    if not active:
        raise ValidationError("no active items to print")
    labels = []
    for item in active:
        svg = matrix_to_svg(provider(build_scan_url(item.token, base_url)), module_size=3)
        labels.append(
            '<figure class="label">'
            f"{svg}"
            f"<figcaption><strong>{escape(item.name)}</strong>"
            f"<span>{escape(item.category)}</span>"
            "<small>Found this? Scan to message the owner.</small></figcaption>"
            "</figure>"
        )
    return (
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        f"<title>{escape(title)}</title><style>{_STYLE}</style></head><body>"
        f"<h1>{escape(title)}</h1>"
        f'<div class="grid" style="grid-template-columns:repeat({columns},1fr)">'
        + "".join(labels)
        + "</div></body></html>"
    )
