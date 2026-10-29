"""
posts/tasks.py — Celery background tasks for the post lifecycle.
"""

import logging

from celery import shared_task

from apps.posts.lifecycle import run_post_lifecycle as run_lifecycle

logger = logging.getLogger(__name__)


@shared_task(name="apps.posts.tasks.run_post_lifecycle")
def run_post_lifecycle():
    """Periodic lifecycle jobs (renewal reminders, auto-expiry). Scheduled hourly by Celery beat."""
    result = run_lifecycle()
    logger.info("Post lifecycle run finished: %s", result)
    return result
