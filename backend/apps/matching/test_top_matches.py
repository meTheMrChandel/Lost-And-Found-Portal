"""
matching/test_top_matches.py — Only approved reports are matched, impossible pairs are
skipped, each lost report keeps its best three suggestions, and the owner is told once
about each ("This might be yours").
"""

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.matching.models import Match
from apps.matching.services import run_matching
from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer
from apps.posts.models import Category, Post


def make_user(email, reg, **extra):
    return User.objects.create_user(email=email, registration_number=reg, password="TestPassword123", full_name=email.split(".")[0].title(), **extra)


@pytest.fixture
def setup(db):
    call_command("seed_data")
    owner = make_user("owner.top@iitrpr.ac.in", "2024CSM1600")
    admin = make_user("admin.top@iitrpr.ac.in", "2024ADM1601", is_staff=True)
    return owner, admin


def lost_bottle(owner, **extra):
    fields = dict(
        author=owner, post_type=Post.PostType.LOST, category=Category.objects.get(slug="bottle"),
        title="Blue Milton steel water bottle", description="Blue Milton steel bottle with a dent and a sticker",
        last_seen_place="Central Library 2nd floor", last_seen_time=timezone.now() - timedelta(days=1),
        status=Post.Status.APPROVED, hidden_proof="Name scratched under the cap",
    )
    fields.update(extra)
    return Post.objects.create(**fields)


def found_bottle(n, **extra):
    finder = make_user(f"finder{n}.top@iitrpr.ac.in", f"2024CSM17{n:02d}")
    fields = dict(
        author=finder, post_type=Post.PostType.FOUND, category=Category.objects.get(slug="bottle"),
        title="Found blue Milton steel bottle", description="Blue steel Milton bottle with a dent and a sticker",
        last_seen_place="Central Library 2nd floor", last_seen_time=timezone.now(),
        status=Post.Status.APPROVED, custody_location=Post.CustodyLocation.SECURITY_OFFICE,
    )
    fields.update(extra)
    return Post.objects.create(**fields)


@pytest.mark.django_db
class TestTopMatches:
    def test_pending_reports_are_not_matched(self, setup):
        owner, _ = setup
        lost_bottle(owner)
        found_bottle(1, status=Post.Status.PENDING)
        assert run_matching()["matches_created"] == 0

    def test_only_the_best_three_are_kept_and_the_owner_is_told_once_each(self, setup):
        owner, _ = setup
        lost = lost_bottle(owner)
        finds = [found_bottle(n, last_seen_place=place) for n, place in enumerate(
            ["Central Library 2nd floor", "Central Library", "Library", "Mess hall"])]

        result = run_matching()
        assert result["matches_created"] == 3 and result["owners_notified"] == 3
        kept = set(Match.objects.filter(lost_post=lost).values_list("found_post_id", flat=True))
        assert finds[3].id not in kept  # the weakest one

        notes = Notification.objects.filter(recipient=owner, title="This might be yours")
        assert notes.count() == 3
        assert all(m.owner_notified_at for m in Match.objects.all())

        # Running again tells nobody anything new
        assert run_matching()["owners_notified"] == 0
        assert notes.count() == 3

    def test_impossible_pairs_are_skipped(self, setup):
        owner, _ = setup
        lost_bottle(owner)
        found_bottle(1, category=Category.objects.get(slug="keys"))
        found_bottle(2, last_seen_time=timezone.now() - timedelta(days=5))  # found before it was lost
        found_bottle(3, last_seen_time=timezone.now() + timedelta(days=40))
        assert run_matching()["matches_created"] == 0

    def test_notification_links_the_found_report_on_the_feed(self, setup):
        owner, _ = setup
        lost_bottle(owner)
        found = found_bottle(1)
        run_matching()
        note = Notification.objects.get(recipient=owner)
        assert NotificationSerializer(note).data["action_url"] == f"/feed?post={found.id}"
        assert "Central Library" in note.body

    def test_private_found_reports_are_not_linked(self, setup):
        owner, _ = setup
        lost_bottle(owner)
        found_bottle(1, inform_admin_privately=True)
        run_matching()
        note = Notification.objects.get(recipient=owner)
        assert "found_post_id" not in note.data
        assert NotificationSerializer(note).data["action_url"] == "/my-reports"

    def test_approving_a_report_matches_it_right_away(self, setup):
        owner, admin = setup
        lost_bottle(owner)
        found = found_bottle(1, status=Post.Status.PENDING)
        client = APIClient()
        client.force_authenticate(admin)
        res = client.post(f"/api/v1/adminpanel/posts/{found.id}/review/", {"action": "APPROVE"}, format="json")
        assert res.status_code == 200
        match = Match.objects.get(found_post=found)
        assert match.owner_notified_at is not None

        listed = client.get("/api/v1/matching/")
        rows = listed.data.get("data", listed.data)
        rows = rows.get("results", rows) if isinstance(rows, dict) else rows
        assert rows[0]["owner_notified_at"] is not None
