"""
matching/tests.py — Automated tests for the Automated Matching Engine.
"""

from datetime import date, timedelta
from io import StringIO
import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.posts.models import Category, Post, SiteSettings
from apps.matching.models import Match, MatchAuditLog
from apps.matching.services import calculate_match_score, run_matching
from apps.matching.tasks import run_matching_engine


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def student_user(db):
    user = User.objects.create_user(
        email="student1@iitrpr.ac.in",
        password="ValidPassword@123",
        full_name="Rohan Sharma",
        registration_number="2024CSM1050",
    )
    user.is_email_verified = True
    user.save()
    return user


@pytest.fixture
def student_user_2(db):
    user = User.objects.create_user(
        email="student2@iitrpr.ac.in",
        password="ValidPassword@123",
        full_name="Priya Verma",
        registration_number="2024CSM1051",
    )
    user.is_email_verified = True
    user.save()
    return user


@pytest.fixture
def admin_user(db):
    user = User.objects.create_user(
        email="admin_matcher@iitrpr.ac.in",
        password="AdminPassword@123",
        full_name="Staff Admin",
        registration_number="2020ADM0001",
        is_staff=True,
    )
    user.is_email_verified = True
    user.is_campus_admin = True
    user.save()
    return user


@pytest.fixture
def categories(db):
    cat_laptop, _ = Category.objects.get_or_create(
        name="Laptop", defaults={"slug": "laptop", "icon": "laptop", "is_sensitive": False}
    )
    cat_keys, _ = Category.objects.get_or_create(
        name="Keys", defaults={"slug": "keys", "icon": "key", "is_sensitive": False}
    )
    cat_umbrella, _ = Category.objects.get_or_create(
        name="Umbrella", defaults={"slug": "umbrella", "icon": "umbrella", "is_sensitive": False}
    )
    return {"laptop": cat_laptop, "keys": cat_keys, "umbrella": cat_umbrella}


@pytest.mark.django_db
class TestAutomatedMatchingEngine:
    """Tests for algorithmic scoring, Celery task, API queue, and review actions."""

    def test_true_pair_scores_above_threshold_and_creates_suggested_match(
        self, student_user, student_user_2, categories
    ):
        """A closely matching lost and found pair scores >= 0.75 and becomes a Suggested match."""
        now = timezone.now()

        lost_post = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=categories["laptop"],
            title="Dell Inspiron 15 Black Laptop",
            description="Black Dell laptop 15-inch with sticker of Linux on back",
            last_seen_place="Library Reading Room 2nd Floor",
            last_seen_time=now - timedelta(days=1),
            status=Post.Status.APPROVED,
        )

        found_post = Post.objects.create(
            author=student_user_2,
            post_type=Post.PostType.FOUND,
            category=categories["laptop"],
            title="Found Dell Laptop Black",
            description="Found a black 15 inch Dell laptop with sticker in reading room",
            last_seen_place="Central Library 2nd Floor",
            last_seen_time=now,
            status=Post.Status.APPROVED,
            custody_location=Post.CustodyLocation.ADMIN_OFFICE,
        )

        score, breakdown = calculate_match_score(lost_post, found_post)
        assert score >= 0.75, f"Expected high score for true pair, got {score}"

        # Run matching
        result = run_matching()
        assert result["matches_created"] == 1

        match = Match.objects.filter(lost_post=lost_post, found_post=found_post).first()
        assert match is not None
        assert match.status == Match.Status.SUGGESTED
        assert match.score >= 0.75

        # Check audit log was recorded
        audit = MatchAuditLog.objects.filter(match=match).first()
        assert audit is not None
        assert audit.action == "MATCH_SUGGESTED"

    def test_unrelated_pair_scores_below_threshold_and_is_not_matched(
        self, student_user, student_user_2, categories
    ):
        """Unrelated items (different category, location, dates, and words) must not match."""
        now = timezone.now()
        lost_post = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=categories["keys"],
            title="Cycle key with blue ring",
            description="Single silver key for Hero bicycle",
            last_seen_place="Cycle Stand Satluj",
            last_seen_time=now - timedelta(days=20),
            status=Post.Status.APPROVED,
        )

        found_post = Post.objects.create(
            author=student_user_2,
            post_type=Post.PostType.FOUND,
            category=categories["umbrella"],
            title="Large black folding umbrella",
            description="Windproof umbrella found left on cafeteria bench",
            last_seen_place="Main Cafeteria",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )

        score, _ = calculate_match_score(lost_post, found_post)
        assert score < 0.75, f"Expected low score for unrelated pair, got {score}"

        result = run_matching()
        assert Match.objects.filter(lost_post=lost_post, found_post=found_post).exists() is False

    def test_rerunning_task_creates_no_duplicate_pair(
        self, student_user, student_user_2, categories
    ):
        """Re-running the matching engine task must be strictly idempotent."""
        now = timezone.now()
        lost = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=categories["laptop"],
            title="MacBook Air M2 Silver",
            description="Silver MacBook Air M2 in grey sleeve",
            last_seen_place="Computer Lab 1",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )

        found = Post.objects.create(
            author=student_user_2,
            post_type=Post.PostType.FOUND,
            category=categories["laptop"],
            title="Apple MacBook Air M2",
            description="Found Apple MacBook laptop silver in grey case",
            last_seen_place="Computer Lab 1",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )

        # First run
        run1 = run_matching()
        assert run1["matches_created"] == 1
        assert Match.objects.filter(lost_post=lost, found_post=found).count() == 1

        # Second run (Idempotency check)
        run2 = run_matching()
        assert run2["matches_created"] == 0
        assert Match.objects.filter(lost_post=lost, found_post=found).count() == 1

        # Third run via Celery shared task
        run3 = run_matching_engine()
        assert run3["matches_created"] == 0
        assert Match.objects.filter(lost_post=lost, found_post=found).count() == 1

    def test_same_author_posts_are_not_matched(self, student_user, categories):
        """A user reporting both a lost and found post cannot be matched against themselves."""
        now = timezone.now()
        lost = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=categories["laptop"],
            title="Same User Laptop",
            description="Laptop lost",
            last_seen_place="Library",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )
        found = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.FOUND,
            category=categories["laptop"],
            title="Same User Laptop",
            description="Laptop found",
            last_seen_place="Library",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )

        score, _ = calculate_match_score(lost, found)
        assert score == 0.0
        run_matching()
        assert Match.objects.filter(lost_post=lost, found_post=found).exists() is False

    def test_admin_match_queue_listing_and_filtering(
        self, api_client, admin_user, student_user, student_user_2, categories
    ):
        """Admin can list and filter suggested matches in the match queue."""
        now = timezone.now()
        lost = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=categories["laptop"],
            title="HP Pavilion Laptop",
            description="Blue HP Pavilion laptop",
            last_seen_place="Lecture Hall 1",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )
        found = Post.objects.create(
            author=student_user_2,
            post_type=Post.PostType.FOUND,
            category=categories["laptop"],
            title="HP Pavilion Blue Laptop",
            description="Found HP Pavilion laptop",
            last_seen_place="Lecture Hall 1",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )
        match = Match.objects.create(
            lost_post=lost,
            found_post=found,
            score=0.88,
            status=Match.Status.SUGGESTED,
        )

        api_client.force_authenticate(user=admin_user)

        # GET /api/v1/matching/
        res = api_client.get("/api/v1/matching/")
        assert res.status_code == status.HTTP_200_OK
        results = res.data.get("results", res.data)
        assert len(results) >= 1
        assert any(item["id"] == str(match.id) for item in results)

        # Filter by status
        res_filtered = api_client.get("/api/v1/matching/?status=suggested")
        assert res_filtered.status_code == status.HTTP_200_OK

        # Retrieve detail
        res_detail = api_client.get(f"/api/v1/matching/{match.id}/")
        assert res_detail.status_code == status.HTTP_200_OK
        assert res_detail.data["score"] == 0.88
        assert res_detail.data["lost_post"]["title"] == "HP Pavilion Laptop"

    def test_admin_match_actions_confirm_and_dismiss(
        self, api_client, admin_user, student_user, student_user_2, categories
    ):
        """Admin can confirm a suggested match or dismiss an inaccurate suggestion."""
        now = timezone.now()
        lost = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=categories["laptop"],
            title="Asus Zenbook Laptop",
            description="Grey Asus Zenbook",
            last_seen_place="Hostel Beas",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )
        found = Post.objects.create(
            author=student_user_2,
            post_type=Post.PostType.FOUND,
            category=categories["laptop"],
            title="Asus Zenbook Found",
            description="Found grey Asus Zenbook",
            last_seen_place="Hostel Beas",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )
        match = Match.objects.create(
            lost_post=lost,
            found_post=found,
            score=0.92,
            status=Match.Status.SUGGESTED,
        )

        api_client.force_authenticate(user=admin_user)

        # 1. Action: CONFIRM
        res = api_client.post(
            f"/api/v1/matching/{match.id}/action/",
            {"action": "CONFIRM", "notes": "Verified visually, very high likelihood."},
        )
        assert res.status_code == status.HTTP_200_OK
        match.refresh_from_db()
        assert match.status == Match.Status.CONFIRMED
        assert match.assigned_to == admin_user
        assert MatchAuditLog.objects.filter(match=match, action="CONFIRM_MATCH").exists()

        # 2. Action: DISMISS
        res_dismiss = api_client.post(
            f"/api/v1/matching/{match.id}/action/",
            {"action": "DISMISS", "notes": "Owner confirmed not their serial number."},
        )
        assert res_dismiss.status_code == status.HTTP_200_OK
        match.refresh_from_db()
        assert match.status == Match.Status.DISMISSED
        assert MatchAuditLog.objects.filter(match=match, action="DISMISS_MATCH").exists()

    def test_student_cannot_access_admin_match_endpoints(
        self, api_client, student_user, student_user_2, categories
    ):
        """Regular student accounts are forbidden from accessing admin match queues and review actions."""
        now = timezone.now()
        lost = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=categories["laptop"],
            title="Restricted Match Post",
            description="Restricted",
            last_seen_place="Campus",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )
        found = Post.objects.create(
            author=student_user_2,
            post_type=Post.PostType.FOUND,
            category=categories["laptop"],
            title="Restricted Match Found",
            description="Restricted",
            last_seen_place="Campus",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )
        match = Match.objects.create(
            lost_post=lost,
            found_post=found,
            score=0.85,
            status=Match.Status.SUGGESTED,
        )

        api_client.force_authenticate(user=student_user)

        # Student cannot list admin match queue
        res_list = api_client.get("/api/v1/matching/")
        assert res_list.status_code == status.HTTP_403_FORBIDDEN

        # Student cannot trigger manual matching run
        res_run = api_client.post("/api/v1/matching/run/")
        assert res_run.status_code == status.HTTP_403_FORBIDDEN

        # Student cannot execute action
        res_action = api_client.post(
            f"/api/v1/matching/{match.id}/action/",
            {"action": "CONFIRM"},
        )
        assert res_action.status_code == status.HTTP_403_FORBIDDEN

    def test_student_can_view_confirmed_matches_for_own_posts(
        self, api_client, student_user, student_user_2, categories
    ):
        """Student can view their confirmed matches via the my-matches endpoint."""
        now = timezone.now()
        lost = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=categories["laptop"],
            title="My Personal Laptop",
            description="My lost laptop",
            last_seen_place="Library",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )
        found = Post.objects.create(
            author=student_user_2,
            post_type=Post.PostType.FOUND,
            category=categories["laptop"],
            title="Found Laptop Personal",
            description="Found laptop",
            last_seen_place="Library",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )

        # Match in suggested state is NOT visible to student
        match = Match.objects.create(
            lost_post=lost,
            found_post=found,
            score=0.89,
            status=Match.Status.SUGGESTED,
        )

        api_client.force_authenticate(user=student_user)
        res = api_client.get("/api/v1/matching/my-matches/")
        assert res.status_code == status.HTTP_200_OK
        results = res.data.get("results", res.data)
        assert len(results) == 0

        # When confirmed by admin, it becomes visible to the student
        match.status = Match.Status.CONFIRMED
        match.save()

        res2 = api_client.get("/api/v1/matching/my-matches/")
        assert res2.status_code == status.HTTP_200_OK
        results2 = res2.data.get("results", res2.data)
        assert len(results2) == 1
        assert results2[0]["id"] == str(match.id)

    def test_run_matching_management_command(self, db):
        """Management command 'run_matching' runs cleanly from CLI."""
        out = StringIO()
        call_command("run_matching", stdout=out)
        output = out.getvalue()
        assert "Matching engine completed successfully!" in output
