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


@shared_task(name="apps.matching.tasks.run_matching_batch")
def run_matching_batch(after=None):
    """
    One batch of the twice-daily matching run (settings.MATCHING_BATCH_SIZE lost reports).
    Celery beat starts it with no cursor; each batch queues the next one after
    settings.BATCH_DELAY_SECONDS until every lost report has been handled.
    """
    from django.conf import settings

    result = run_matching(batch_size=settings.MATCHING_BATCH_SIZE, after=after)
    logger.info(
        "Matching batch after=%s: lost_reports=%s, created=%s, next_after=%s",
        after, result["lost_reports"], result["matches_created"], result["next_after"],
    )
    if result["next_after"]:
        run_matching_batch.apply_async(
            kwargs={"after": result["next_after"]}, countdown=settings.BATCH_DELAY_SECONDS
        )
    return result
