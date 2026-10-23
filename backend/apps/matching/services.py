"""
matching/services.py — Algorithmic similarity scoring & matching engine.

Scores LOST vs FOUND post pairs across four dimensions:
  1. Category match (weight: 0.35)
  2. Date proximity window (weight: 0.20)
  3. Location keyword overlap (weight: 0.20)
  4. Title and description text similarity (weight: 0.25)

Pairs scoring at or above SiteSettings.match_threshold (default 0.75)
become Suggested matches in the admin match queue.
"""

import logging
import re
from difflib import SequenceMatcher
from datetime import date
from typing import Optional, Tuple, Set, Dict, Any

from django.db import transaction
from django.utils import timezone

from apps.posts.models import Post, SiteSettings
from apps.matching.models import Match, MatchAuditLog

logger = logging.getLogger(__name__)

# Stopwords to remove from location tokens
LOCATION_STOPWORDS = {
    "in", "at", "near", "the", "on", "of", "and", "around", "floor",
    "room", "building", "block", "side", "area", "gate", "front", "behind",
    "opposite", "hall", "ground", "department", "dept"
}

# General English stopwords for text similarity
TEXT_STOPWORDS = {
    "a", "an", "the", "with", "is", "was", "are", "were", "for", "it",
    "my", "i", "to", "and", "or", "of", "in", "on", "at", "has", "have",
    "had", "this", "that", "these", "those", "by", "from", "be", "been",
    "its", "me", "we", "our", "you", "your", "he", "she", "they", "them",
    "lost", "found", "item", "belonging", "please", "help", "contact"
}


def _tokenize(text: str, stopwords: Set[str]) -> Set[str]:
    """Tokenize string into lowercase alphanumeric words, stripping stopwords."""
    if not text:
        return set()
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {w for w in words if w not in stopwords and len(w) > 1}


def score_category(lost: Post, found: Post) -> float:
    """
    Category scoring (weight 0.35).
    - Identical category: 1.0
    - Either is 'other': 0.25 (lenient fallback)
    - Different categories: 0.0
    """
    if lost.category_id == found.category_id:
        return 1.0

    lost_slug = getattr(lost.category, "slug", "")
    found_slug = getattr(found.category, "slug", "")
    if lost_slug == "other" or found_slug == "other":
        return 0.25

    return 0.0


def score_date_window(lost: Post, found: Post) -> float:
    """
    Date window scoring (weight 0.20).
    Lost date should generally precede or equal found date.
    Calculates absolute delta in days between last_seen_time:
      0-1 day:   1.0
      2-3 days:  0.85
      4-7 days:  0.70
      8-14 days: 0.40
      15-30 days: 0.15
      >30 days:  0.0
    """
    t1 = lost.last_seen_time
    t2 = found.last_seen_time
    if not t1 or not t2:
        return 0.5  # Neutral if time is unspecified

    delta = abs((t2.date() - t1.date()).days)
    if delta <= 1:
        return 1.0
    elif delta <= 3:
        return 0.85
    elif delta <= 7:
        return 0.70
    elif delta <= 14:
        return 0.40
    elif delta <= 30:
        return 0.15
    return 0.0


def score_location_keywords(lost: Post, found: Post) -> float:
    """
    Location keyword overlap scoring (weight 0.20).
    Compares cleaned campus location tokens from last_seen_place.
    """
    loc1 = lost.last_seen_place or ""
    loc2 = found.last_seen_place or ""

    if not loc1.strip() or not loc2.strip():
        return 0.2  # Unspecified location gets small neutral base

    tokens1 = _tokenize(loc1, LOCATION_STOPWORDS)
    tokens2 = _tokenize(loc2, LOCATION_STOPWORDS)

    if not tokens1 or not tokens2:
        # Fall back to raw string similarity if all tokens were stopwords
        return SequenceMatcher(None, loc1.lower().strip(), loc2.lower().strip()).ratio()

    intersection = tokens1 & tokens2
    if not intersection:
        # Check substring match (e.g. 'satluj' in 'hostel satluj')
        s1 = "".join(tokens1)
        s2 = "".join(tokens2)
        if s1 in s2 or s2 in s1:
            return 0.8
        return 0.0

    jaccard = len(intersection) / len(tokens1 | tokens2)
    overlap = len(intersection) / min(len(tokens1), len(tokens2))

    return min(1.0, max(jaccard * 1.2, overlap * 0.9))


def score_text_similarity(lost: Post, found: Post) -> float:
    """
    Description and title text similarity scoring (weight 0.25).
    Combines token overlap with difflib sequence matching.
    """
    text1 = f"{lost.title} {lost.description}".strip()
    text2 = f"{found.title} {found.description}".strip()

    if not text1 or not text2:
        return 0.0

    tokens1 = _tokenize(text1, TEXT_STOPWORDS)
    tokens2 = _tokenize(text2, TEXT_STOPWORDS)

    token_score = 0.0
    if tokens1 and tokens2:
        intersection = tokens1 & tokens2
        jaccard = len(intersection) / len(tokens1 | tokens2)
        overlap = len(intersection) / min(len(tokens1), len(tokens2))
        token_score = max(jaccard * 1.25, overlap * 0.9)

    seq_score = SequenceMatcher(None, text1.lower(), text2.lower()).ratio()

    combined = max(token_score, seq_score * 0.8)
    return min(1.0, max(0.0, combined))


def calculate_match_score(lost: Post, found: Post) -> Tuple[float, Dict[str, float]]:
    """
    Calculate overall match confidence score (0.0 – 1.0) between a LOST and FOUND post.
    Returns (total_score, breakdown_dict).
    """
    # Defensive checks
    if lost.post_type != Post.PostType.LOST or found.post_type != Post.PostType.FOUND:
        return 0.0, {}

    # Same author cannot match their own lost item to their own found item
    if lost.author_id == found.author_id:
        return 0.0, {}

    cat_score = score_category(lost, found)
    date_score = score_date_window(lost, found)
    loc_score = score_location_keywords(lost, found)
    text_score = score_text_similarity(lost, found)

    # Weights
    w_cat = 0.35
    w_date = 0.20
    w_loc = 0.20
    w_text = 0.25

    total = (
        (cat_score * w_cat)
        + (date_score * w_date)
        + (loc_score * w_loc)
        + (text_score * w_text)
    )

    total = min(1.0, max(0.0, round(total, 4)))

    breakdown = {
        "category": round(cat_score, 3),
        "date": round(date_score, 3),
        "location": round(loc_score, 3),
        "text": round(text_score, 3),
        "total": total,
    }

    return total, breakdown


def run_matching(post_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Executes the automated matching algorithm across active posts.
    
    If post_id is provided, only pairs involving this post are evaluated.
    Otherwise, all active LOST posts are compared against all active FOUND posts.

    Pairs scoring >= SiteSettings.match_threshold become Suggested matches.
    Ensures idempotency (no duplicate match records created on subsequent runs).
    """
    settings = SiteSettings.get()
    threshold = settings.match_threshold

    active_statuses = [Post.Status.APPROVED, Post.Status.PENDING]

    # Select candidates
    if post_id:
        try:
            target_post = Post.objects.select_related("category", "author").get(id=post_id)
        except Post.DoesNotExist:
            logger.warning(f"Post {post_id} does not exist for matching.")
            return {"scanned_pairs": 0, "matches_created": 0, "matches_updated": 0}

        if target_post.post_type == Post.PostType.LOST:
            lost_posts = [target_post]
            found_posts = list(
                Post.objects.filter(
                    post_type=Post.PostType.FOUND,
                    status__in=active_statuses,
                ).exclude(author_id=target_post.author_id).select_related("category", "author")
            )
        elif target_post.post_type == Post.PostType.FOUND:
            found_posts = [target_post]
            lost_posts = list(
                Post.objects.filter(
                    post_type=Post.PostType.LOST,
                    status__in=active_statuses,
                ).exclude(author_id=target_post.author_id).select_related("category", "author")
            )
        else:
            return {"scanned_pairs": 0, "matches_created": 0, "matches_updated": 0}
    else:
        lost_posts = list(
            Post.objects.filter(
                post_type=Post.PostType.LOST,
                status__in=active_statuses,
            ).select_related("category", "author")
        )
        found_posts = list(
            Post.objects.filter(
                post_type=Post.PostType.FOUND,
                status__in=active_statuses,
            ).select_related("category", "author")
        )

    scanned_pairs = 0
    matches_created = 0
    matches_updated = 0

    for lost in lost_posts:
        for found in found_posts:
            if lost.author_id == found.author_id:
                continue

            scanned_pairs += 1
            score, breakdown = calculate_match_score(lost, found)

            if score >= threshold:
                with transaction.atomic():
                    match, created = Match.objects.get_or_create(
                        lost_post=lost,
                        found_post=found,
                        defaults={
                            "score": score,
                            "status": Match.Status.SUGGESTED,
                        },
                    )

                    if created:
                        matches_created += 1
                        MatchAuditLog.objects.create(
                            match=match,
                            admin=None,
                            action="MATCH_SUGGESTED",
                            to_status=Match.Status.SUGGESTED,
                            notes=(
                                f"Automated engine suggestion (score={score:.2f} >= threshold {threshold:.2f}). "
                                f"Breakdown: cat={breakdown['category']}, date={breakdown['date']}, "
                                f"loc={breakdown['location']}, text={breakdown['text']}"
                            ),
                        )
                    else:
                        # Only update score if match is still in SUGGESTED state
                        if match.status == Match.Status.SUGGESTED:
                            if match.score != score:
                                match.score = score
                                match.save(update_fields=["score", "updated_at"])
                                matches_updated += 1

    return {
        "scanned_pairs": scanned_pairs,
        "matches_created": matches_created,
        "matches_updated": matches_updated,
        "threshold_used": threshold,
    }
