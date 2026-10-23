"""
matching/tasks.py — Celery background tasks for the matching engine.
"""

import logging
from celery import shared_task
from apps.matching.services import run_matching

logger = logging.getLogger(__name__)


@shared_task(name="apps.matching.tasks.run_matching_engine")
def run_matching_engine(post_id=None):
    """
    Celery task that scores lost vs found pairs.
    Can be run periodically via Celery beat, or triggered asynchronously on post creation/approval.
    """
    logger.info(f"Starting matching engine task (post_id={post_id})")
    result = run_matching(post_id=post_id)
    logger.info(
        f"Matching engine finished: scanned={result['scanned_pairs']}, "
        f"created={result['matches_created']}, updated={result['matches_updated']}"
    )
    return result
