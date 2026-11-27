"""Twice-daily batch run: matching split into batches, the Celery chain and the cron endpoint."""

from datetime import timedelta
from unittest import mock

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.matching.models import Match
from apps.matching.services import run_matching
from apps.matching.tasks import run_matching_batch
from apps.matching.tests import categories, student_user, student_user_2  # noqa: F401  (fixtures)
from apps.posts.models import Post

URL = "/api/v1/internal/run-scheduled-jobs/"
SECRET = "test-cron-secret"


@pytest.fixture
def three_lost_one_found(student_user, student_user_2, categories):  # noqa: F811
    now = timezone.now()
    lost = [
        Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=categories["laptop"],
            title=f"Dell Inspiron 15 Black Laptop {i}",
            description="Black Dell laptop 15-inch with sticker of Linux on back",
            last_seen_place="Library Reading Room 2nd Floor",
            last_seen_time=now - timedelta(days=1),
            status=Post.Status.APPROVED,
        )
        for i in range(3)
    ]
    found = Post.objects.create(
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
    return lost, found


@pytest.mark.django_db
class TestMatchingBatches:
    def test_batches_cover_every_lost_report_once(self, three_lost_one_found):
        lost, _ = three_lost_one_found

        first = run_matching(batch_size=2)
        assert first["lost_reports"] == 2
        assert first["next_after"] is not None

        second = run_matching(batch_size=2, after=first["next_after"])
        assert second["lost_reports"] == 1
        assert second["next_after"] is None

        assert first["matches_created"] + second["matches_created"] == 3
        assert set(Match.objects.values_list("lost_post_id", flat=True)) == {p.id for p in lost}
        # A full run afterwards finds nothing new: batching gave the same result
        assert run_matching()["matches_created"] == 0

    def test_exact_multiple_ends_with_an_empty_batch(self, three_lost_one_found):
        first = run_matching(batch_size=3)
        assert first["lost_reports"] == 3 and first["next_after"] is not None
        last = run_matching(batch_size=3, after=first["next_after"])
        assert last["lost_reports"] == 0 and last["next_after"] is None

    def test_celery_batch_queues_the_next_batch_after_the_delay(self, settings, three_lost_one_found):
        settings.MATCHING_BATCH_SIZE = 2
        settings.BATCH_DELAY_SECONDS = 45
        with mock.patch.object(run_matching_batch, "apply_async") as queue:
            result = run_matching_batch()
        queue.assert_called_once_with(kwargs={"after": result["next_after"]}, countdown=45)

        with mock.patch.object(run_matching_batch, "apply_async") as queue:
            run_matching_batch(after=result["next_after"])
        queue.assert_not_called()


@pytest.mark.django_db
class TestScheduledJobsEndpoint:
    def post(self, body, secret=SECRET):
        headers = {"HTTP_X_CRON_SECRET": secret} if secret is not None else {}
        return APIClient().post(URL, body, format="json", **headers)

    def test_disabled_without_cron_secret(self, settings):
        settings.CRON_SECRET = ""
        assert self.post({"step": "lifecycle"}).status_code == 404

    def test_rejects_wrong_or_missing_secret(self, settings):
        settings.CRON_SECRET = SECRET
        assert self.post({"step": "lifecycle"}, secret="wrong").status_code == 403
        assert self.post({"step": "lifecycle"}, secret=None).status_code == 403

    def test_rejects_unknown_step_and_bad_cursor(self, settings):
        settings.CRON_SECRET = SECRET
        assert self.post({"step": "everything"}).status_code == 400
        assert self.post({"step": "matching", "after": "not-a-uuid"}).status_code == 400

    def test_lifecycle_step(self, settings):
        settings.CRON_SECRET = SECRET
        settings.BATCH_DELAY_SECONDS = 30
        res = self.post({"step": "lifecycle"})
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["step"] == "lifecycle"
        assert data["next_after"] is None
        assert set(data["result"]) >= {"reminders_sent"}

    def test_matching_steps_walk_through_all_batches(self, settings, three_lost_one_found):
        settings.CRON_SECRET = SECRET
        settings.MATCHING_BATCH_SIZE = 2
        settings.BATCH_DELAY_SECONDS = 30

        first = self.post({"step": "matching"}).json()["data"]
        assert first["result"]["lost_reports"] == 2
        assert first["delay_seconds"] == 30
        assert first["next_after"]

        second = self.post({"step": "matching", "after": first["next_after"]}).json()["data"]
        assert second["result"]["lost_reports"] == 1
        assert second["next_after"] is None
        assert Match.objects.count() == 3
