"""Command line demo: python -m qr_sandbox demo | sheet"""

import argparse
import json
import sys

from .constants import DEFAULT_BASE_URL
from .models import Owner
from .registry import ItemRegistry
from .scan_page import build_scan_payload
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
    return 0
