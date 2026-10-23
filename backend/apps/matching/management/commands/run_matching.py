"""
matching/management/commands/run_matching.py — CLI command to trigger the matching engine.
"""

from django.core.management.base import BaseCommand
from apps.matching.services import run_matching


class Command(BaseCommand):
    help = "Runs the automated matching engine to score LOST vs FOUND post pairs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--post-id",
            type=str,
            default=None,
            help="Optional UUID of a specific post to run matching for.",
        )

    def handle(self, *args, **options):
        post_id = options.get("post_id")
        self.stdout.write(
            self.style.NOTICE(f"Running matching engine (target post_id={post_id})...")
        )

        result = run_matching(post_id=post_id)

        self.stdout.write(
            self.style.SUCCESS(
                f"Matching engine completed successfully!\n"
                f"  Scanned pairs:   {result['scanned_pairs']}\n"
                f"  Matches created: {result['matches_created']}\n"
                f"  Matches updated: {result['matches_updated']}\n"
                f"  Threshold used:  {result['threshold_used']}"
            )
        )
