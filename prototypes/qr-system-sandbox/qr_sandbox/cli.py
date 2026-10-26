"""Command line demo: python -m qr_sandbox demo | sheet"""

import argparse
import json
import sys

from .backends import placeholder_matrix, qrcode_library_provider
from .constants import DEFAULT_BASE_URL
from .models import Owner
from .registry import ItemRegistry
from .scan_page import build_scan_payload
from .sheet import render_sheet
from .urls import build_scan_url

DEMO_OWNER = Owner(
    "00000000-0000-4000-8000-000000000001",
    "Demo Student",
    "2026CSM9999",
    "demo@iitrpr.ac.in",
    "9999999999",
)


def _demo_registry() -> ItemRegistry:
    registry = ItemRegistry()
    registry.register(DEMO_OWNER, "Blue bicycle", "bicycle")
    registry.register(DEMO_OWNER, "Black laptop", "laptop")
    registry.register(DEMO_OWNER, "White earbuds", "earbuds")
    return registry


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="qr_sandbox", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    demo = sub.add_parser("demo", help="register demo items and show a scan page")
    demo.add_argument("--base-url", default=DEFAULT_BASE_URL)
    sheet = sub.add_parser("sheet", help="write a printable QR sheet for the demo items")
    sheet.add_argument("--out", required=True, help="HTML file to write")
    sheet.add_argument("--base-url", default=DEFAULT_BASE_URL)
    sheet.add_argument("--columns", type=int, default=3)
    sheet.add_argument(
        "--real-qr",
        action="store_true",
        help="use the optional 'qrcode' package for scannable codes",
    )
    return parser


def main(argv=None, out=None) -> int:
    out = out or sys.stdout
    args = build_parser().parse_args(argv)
    if args.command == "demo":
        registry = _demo_registry()
        item = registry.items_for_owner(DEMO_OWNER.owner_id)[0]
        registry.set_lost(item.token, DEMO_OWNER.owner_id)
        print("QR encodes:", build_scan_url(item.token, args.base_url), file=out)
        print(json.dumps(build_scan_payload(item), indent=2), file=out)
    elif args.command == "sheet":
        registry = _demo_registry()
        provider = qrcode_library_provider if args.real_qr else placeholder_matrix
        html = render_sheet(
            registry.items_for_owner(DEMO_OWNER.owner_id),
            base_url=args.base_url,
            provider=provider,
            columns=args.columns,
        )
        with open(args.out, "w", encoding="utf-8") as handle:
            handle.write(html)
        print(f"wrote {args.out}", file=out)
    return 0
