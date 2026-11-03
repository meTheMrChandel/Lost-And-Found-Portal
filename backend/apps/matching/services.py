"""
matching/services.py — Algorithmic similarity scoring & matching engine.

Scores LOST vs FOUND post pairs across four dimensions:
  1. Category match (weight: 0.35)
  2. Date proximity window (weight: 0.20)
  3. Location keyword overlap (weight: 0.20)
  4. Title and description text similarity (weight: 0.25)

Only approved reports are matched, and pairs that can't be the same item (different
category, found long before it was lost, more than 30 days apart) are skipped. The best
three found reports per lost report scoring at or above SiteSettings.match_threshold
(default 0.75) become Suggested matches, and the lost report's owner is told about each.
"""

import logging
import re
from difflib import SequenceMatcher
from datetime import date, timedelta
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


# Each lost report keeps at most this many suggestions; its owner is told about each one
TOP_MATCHES_PER_LOST_REPORT = 3
MAX_DAYS_APART = 30
# Times are typed in by people, so a found time a little before the lost time is allowed
FOUND_BEFORE_LOST_GRACE = timedelta(days=1)


def passes_hard_gates(lost: Post, found: Post) -> bool:
    """Pairs that can't be the same item, however similar the wording."""
    if lost.category_id != found.category_id and "other" not in (
        getattr(lost.category, "slug", ""),
        getattr(found.category, "slug", ""),
    ):
        return False
    t1, t2 = lost.last_seen_time, found.last_seen_time
    if t1 and t2:
        if t2 < t1 - FOUND_BEFORE_LOST_GRACE:
            return False  # found before it was lost
        if abs((t2 - t1).days) > MAX_DAYS_APART:
            return False
    return True


def run_matching(post_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Suggests matches between approved lost and found reports.

    For every lost report, found reports that pass the hard gates are scored and the
    best TOP_MATCHES_PER_LOST_REPORT at or above SiteSettings.match_threshold become
    Suggested matches in the admin queue. The lost report's owner is told once about
    each ("This might be yours"). Re-running is safe: nothing is duplicated.

    If post_id is given, only lost reports that could involve that post are ranked.
    """
    from apps.notifications.events import notify_owner_possible_match

    settings = SiteSettings.get()
    threshold = settings.match_threshold
    empty = {"scanned_pairs": 0, "matches_created": 0, "matches_updated": 0, "owners_notified": 0, "threshold_used": threshold}

    approved = Post.objects.filter(status=Post.Status.APPROVED).select_related("category", "author")
    lost_posts = approved.filter(post_type=Post.PostType.LOST)
    found_posts = list(approved.filter(post_type=Post.PostType.FOUND))

    if post_id:
        target_post = approved.filter(id=post_id).first()
        if target_post is None:
            logger.info("Post %s is not approved (or doesn't exist); skipping matching.", post_id)
            return empty
        if target_post.post_type == Post.PostType.LOST:
            lost_posts = [target_post]
        elif target_post.post_type == Post.PostType.FOUND:
            lost_posts = lost_posts.exclude(author_id=target_post.author_id)
        else:
            return empty

    scanned_pairs = 0
    matches_created = 0
    matches_updated = 0
    owners_notified = 0

    for lost in lost_posts:
        ranked = []
        for found in found_posts:
            if lost.author_id == found.author_id or not passes_hard_gates(lost, found):
                continue
            scanned_pairs += 1
            score, breakdown = calculate_match_score(lost, found)
            if score >= threshold:
                ranked.append((score, found, breakdown))
        ranked.sort(key=lambda r: r[0], reverse=True)

        for score, found, breakdown in ranked[:TOP_MATCHES_PER_LOST_REPORT]:
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
                elif match.status == Match.Status.SUGGESTED and match.score != score:
                    # Only update score if match is still in SUGGESTED state
                    match.score = score
                    match.save(update_fields=["score", "updated_at"])
                    matches_updated += 1

            if match.owner_notified_at is None and match.status != Match.Status.DISMISSED:
                notify_owner_possible_match(match)
                match.owner_notified_at = timezone.now()
                match.save(update_fields=["owner_notified_at"])
                owners_notified += 1

    return {
        "scanned_pairs": scanned_pairs,
        "matches_created": matches_created,
        "matches_updated": matches_updated,
        "owners_notified": owners_notified,
        "threshold_used": threshold,
    }
