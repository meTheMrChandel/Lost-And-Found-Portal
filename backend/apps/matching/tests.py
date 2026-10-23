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


@pytest.mark.django_db
class TestPhase6VerificationAndHandover:
    """
    Test suite for Phase 6: Verification and Handover.
    Covers proof Q&A, meeting mode selection, single-use handover codes,
    case closure with reward settlement, and admin-only permission boundaries.
    """

    @pytest.fixture
    def active_match(self, student_user, student_user_2, categories):
        now = timezone.now()
        lost = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=categories["laptop"],
            title="Dell XPS 13 9310 Silver",
            description="Silver laptop lost in library with black sleeve",
            hidden_proof="Serial number: 8B92-K99, lockscreen wallpaper of Yosemite Valley",
            reward_amount=500,
            last_seen_place="Central Library 2nd Floor",
            last_seen_time=now - timedelta(days=1),
            status=Post.Status.APPROVED,
        )
        found = Post.objects.create(
            author=student_user_2,
            post_type=Post.PostType.FOUND,
            category=categories["laptop"],
            title="Dell XPS 13 Silver",
            description="Found silver Dell XPS laptop in reading room",
            custody_location=Post.CustodyLocation.ADMIN_OFFICE,
            last_seen_place="Central Library 2nd Floor",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )
        return Match.objects.create(
            lost_post=lost,
            found_post=found,
            score=0.96,
            status=Match.Status.CONFIRMED,
        )

    def test_wrong_proof_keeps_match_at_proof_pending(self, api_client, admin_user, active_match):
        """Wrong or incomplete proof keeps the match in 'proof_pending' state."""
        api_client.force_authenticate(user=admin_user)

        res = api_client.post(
            f"/api/v1/matching/{active_match.id}/proof/",
            {
                "questions": [
                    {"question": "What is the lockscreen wallpaper?", "answer": "A beach with palm trees", "is_correct": False},
                    {"question": "Any unique scratch?", "answer": "On the back corner", "is_correct": True},
                ],
                "decision": "KEEP_PENDING",
                "notes": "Wallpaper does not match owner confidential proof on file.",
            },
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        active_match.refresh_from_db()
        assert active_match.status == Match.Status.PROOF_PENDING
        assert len(active_match.proof_questions) == 2
        assert MatchAuditLog.objects.filter(match=active_match, action="PROOF_PENDING").exists()

    def test_correct_proof_moves_match_to_verified(self, api_client, admin_user, active_match):
        """Correct verification of hidden-proof moves match to 'verified' state."""
        api_client.force_authenticate(user=admin_user)

        res = api_client.post(
            f"/api/v1/matching/{active_match.id}/proof/",
            {
                "questions": [
                    {"question": "What is the lockscreen wallpaper?", "answer": "Yosemite Valley", "is_correct": True},
                    {"question": "What is the serial prefix?", "answer": "8B92", "is_correct": True},
                ],
                "decision": "VERIFIED",
                "notes": "Exact match to hidden proof details.",
            },
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        active_match.refresh_from_db()
        assert active_match.status == Match.Status.VERIFIED
        assert active_match.proof_verified_at is not None
        assert MatchAuditLog.objects.filter(match=active_match, action="PROOF_VERIFIED").exists()

    def test_meeting_mode_selection_by_parties_and_admin(
        self, api_client, admin_user, student_user, student_user_2, active_match
    ):
        """Owner, finder, and admin can set meeting mode; unrelated users cannot."""
        # 1. Lost owner sets meeting mode
        api_client.force_authenticate(user=student_user)
        res_owner = api_client.post(
            f"/api/v1/matching/{active_match.id}/meeting-mode/",
            {"meeting_mode": "office"},
        )
        assert res_owner.status_code == status.HTTP_200_OK
        active_match.refresh_from_db()
        assert active_match.meeting_mode == "office"

        # 2. Unrelated student blocked
        other_user = User.objects.create_user(
            email="intruder@iitrpr.ac.in",
            password="ValidPassword@123",
            full_name="Other Student",
            registration_number="2024CSM1099",
        )
        other_user.is_email_verified = True
        other_user.save()

        api_client.force_authenticate(user=other_user)
        res_intruder = api_client.post(
            f"/api/v1/matching/{active_match.id}/meeting-mode/",
            {"meeting_mode": "direct"},
        )
        assert res_intruder.status_code == status.HTTP_403_FORBIDDEN

    def test_handover_code_generation_and_single_use_expiry(
        self, api_client, admin_user, active_match
    ):
        """Handover code works once, transitions match to handed_over, and then immediately expires."""
        active_match.status = Match.Status.VERIFIED
        active_match.save()

        api_client.force_authenticate(user=admin_user)

        # 1. Generate handover code
        res_gen = api_client.post(f"/api/v1/matching/{active_match.id}/handover-code/generate/")
        assert res_gen.status_code == status.HTTP_200_OK
        code = res_gen.data["code"]
        assert len(code) == 6

        active_match.refresh_from_db()
        assert active_match.handover_code_hash != ""
        assert active_match.handover_code_hash != code  # Must be hashed, not plaintext!
        assert active_match.handover_code_used is False

        # 2. Try wrong code first
        res_wrong = api_client.post(
            f"/api/v1/matching/{active_match.id}/handover-code/verify/",
            {"code": "WRONG1"},
        )
        assert res_wrong.status_code == status.HTTP_400_BAD_REQUEST

        # 3. Verify with correct code -> transitions to handed_over
        res_verify = api_client.post(
            f"/api/v1/matching/{active_match.id}/handover-code/verify/",
            {"code": code, "notes": "Handover executed at Admin Office."},
        )
        assert res_verify.status_code == status.HTTP_200_OK
        active_match.refresh_from_db()
        assert active_match.status == Match.Status.HANDED_OVER
        assert active_match.handover_code_used is True
        assert active_match.handed_over_at is not None

        # 4. Try using the code a second time -> MUST EXPIRE and be rejected
        res_reused = api_client.post(
            f"/api/v1/matching/{active_match.id}/handover-code/verify/",
            {"code": code},
        )
        assert res_reused.status_code == status.HTTP_400_BAD_REQUEST
        assert "already been used" in res_reused.data["detail"]

    def test_only_admins_can_change_match_status_and_verify(
        self, api_client, student_user, active_match
    ):
        """Only campus admins have authority to record proof, generate codes, and verify handovers."""
        api_client.force_authenticate(user=student_user)

        # Student cannot submit proof evaluation
        res_proof = api_client.post(
            f"/api/v1/matching/{active_match.id}/proof/",
            {"questions": [{"question": "q", "answer": "a", "is_correct": True}], "decision": "VERIFIED"},
            format="json",
        )
        assert res_proof.status_code == status.HTTP_403_FORBIDDEN

        # Student cannot generate handover code
        res_gen = api_client.post(f"/api/v1/matching/{active_match.id}/handover-code/generate/")
        assert res_gen.status_code == status.HTTP_403_FORBIDDEN

        # Student cannot verify handover code
        res_ver = api_client.post(
            f"/api/v1/matching/{active_match.id}/handover-code/verify/",
            {"code": "XYZ123"},
        )
        assert res_ver.status_code == status.HTTP_403_FORBIDDEN

        # Student cannot close match
        res_close = api_client.post(
            f"/api/v1/matching/{active_match.id}/close/",
            {"reward_amount_settled": 500},
        )
        assert res_close.status_code == status.HTTP_403_FORBIDDEN

    def test_full_case_lifecycle_lost_to_match_to_verify_to_handover_to_closed(
        self, api_client, admin_user, student_user, student_user_2, categories
    ):
        """
        Full lifecycle test (Week 4 exit criterion):
          lost -> match -> verify -> handover -> closed
        Ensures reward is settled, finder credited, and posts updated to RETURNED.
        """
        now = timezone.now()

        # 1. Lost Post created
        lost = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=categories["laptop"],
            title="MacBook Pro 14 Space Gray",
            description="MacBook Pro M2 with IIT Ropar sticker",
            hidden_proof="Wallpaper: Space Nebula; Serial: C02G99",
            reward_amount=1000,
            last_seen_place="Computer Center Lab 2",
            last_seen_time=now - timedelta(days=1),
            status=Post.Status.APPROVED,
        )

        # 2. Found Post created
        found = Post.objects.create(
            author=student_user_2,
            post_type=Post.PostType.FOUND,
            category=categories["laptop"],
            title="Apple MacBook Pro 14",
            description="Found MacBook Pro laptop in computer center lab",
            custody_location=Post.CustodyLocation.SECURITY_OFFICE,
            last_seen_place="Computer Center Lab 2",
            last_seen_time=now,
            status=Post.Status.APPROVED,
        )

        # 3. Matching engine produces Suggested match
        run_res = run_matching()
        assert run_res["matches_created"] >= 1
        match = Match.objects.get(lost_post=lost, found_post=found)
        assert match.status == Match.Status.SUGGESTED

        # 4. Admin confirms match
        api_client.force_authenticate(user=admin_user)
        res_conf = api_client.post(f"/api/v1/matching/{match.id}/action/", {"action": "CONFIRM"})
        assert res_conf.status_code == status.HTTP_200_OK

        # 5. Admin asks hidden-proof questions -> VERIFIED
        res_proof = api_client.post(
            f"/api/v1/matching/{match.id}/proof/",
            {
                "questions": [
                    {"question": "Lockscreen wallpaper?", "answer": "Space Nebula", "is_correct": True},
                    {"question": "Serial number?", "answer": "C02G99", "is_correct": True},
                ],
                "decision": "VERIFIED",
                "notes": "Verified by Admin Office.",
            },
            format="json",
        )
        assert res_proof.status_code == status.HTTP_200_OK
        match.refresh_from_db()
        assert match.status == Match.Status.VERIFIED

        # 6. Admin generates single-use handover code
        res_gen = api_client.post(f"/api/v1/matching/{match.id}/handover-code/generate/")
        assert res_gen.status_code == status.HTTP_200_OK
        code = res_gen.data["code"]

        # 7. Claimant presents code at Security Office -> HANDED OVER
        res_verify = api_client.post(
            f"/api/v1/matching/{match.id}/handover-code/verify/",
            {"code": code, "notes": "Handover done in presence of campus guard."},
        )
        assert res_verify.status_code == status.HTTP_200_OK
        match.refresh_from_db()
        assert match.status == Match.Status.HANDED_OVER

        # 8. Admin closes case and settles reward
        res_close = api_client.post(
            f"/api/v1/matching/{match.id}/close/",
            {"reward_amount_settled": 1000.0, "notes": "Reward settled in full."},
        )
        assert res_close.status_code == status.HTTP_200_OK

        # 9. Final state verification
        match.refresh_from_db()
        lost.refresh_from_db()
        found.refresh_from_db()

        assert match.status == Match.Status.CLOSED
        assert float(match.reward_amount_settled) == 1000.0
        assert match.reward_settled_at is not None
        assert lost.status == Post.Status.RETURNED
        assert found.status == Post.Status.RETURNED
        assert MatchAuditLog.objects.filter(match=match, action="CASE_CLOSED").exists()
