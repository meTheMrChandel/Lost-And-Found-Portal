"""
posts/management/commands/run_lifecycle.py — CLI command to run the periodic post lifecycle jobs.
"""

from django.core.management.base import BaseCommand

from apps.posts.lifecycle import run_post_lifecycle


class Command(BaseCommand):
    help = "Sends renewal reminders and expires overdue posts (what Celery beat runs every hour)."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Running post lifecycle jobs..."))
        result = run_post_lifecycle()
        self.stdout.write(
            self.style.SUCCESS(
                "Post lifecycle run completed.\n"
                + "\n".join(f"  {name.replace('_', ' ').capitalize()}: {count}" for name, count in result.items())
            )
        )
