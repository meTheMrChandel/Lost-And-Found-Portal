"""
posts/test_found_report_owner.py — Finders manage their own found reports through
/posts/lost/<id>/ like owners of lost reports do, without exposing private ones.
"""

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.adminpanel.models import PostAuditLog
from apps.posts.models import Category, Post


def make_user(email, reg):
    return User.objects.create_user(email=email, registration_number=reg, password="TestPassword123", full_name="Test")


@pytest.fixture
def finder(db):
    return make_user("found.finder@iitrpr.ac.in", "2024CSM1070")


@pytest.fixture
def stranger(db):
    return make_user("found.stranger@iitrpr.ac.in", "2024CSM1071")


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def found_post(finder):
    call_command("seed_data")

    def _make(status=Post.Status.INFO_REQUESTED, **fields):
        return Post.objects.create(
            author=finder,
            post_type=Post.PostType.FOUND,
            category=Category.objects.get(slug="keys"),
            title="Found a key ring",
            description="Three keys on a red ring",
            last_seen_place="Cafeteria",
            last_seen_time=timezone.now() - timedelta(hours=3),
            status=status,
            **fields,
        )

    return _make


@pytest.mark.django_db
class TestFinderManagesFoundReport:
    def test_finder_can_answer_an_info_request(self, finder, found_post):
        post = found_post()
        res = client_for(finder).patch(
            f"/api/v1/posts/lost/{post.id}/", {"last_seen_place": "Cafeteria, near the counter"}, format="json"
        )
        assert res.status_code == 200, res.data
        post.refresh_from_db()
        assert post.status == Post.Status.PENDING
        assert post.last_seen_place == "Cafeteria, near the counter"
        assert PostAuditLog.objects.filter(post=post, action="RESUBMIT").exists()

    def test_finder_can_withdraw_a_pending_found_report(self, finder, found_post):
        post = found_post(status=Post.Status.PENDING)
        res = client_for(finder).delete(f"/api/v1/posts/lost/{post.id}/")
        assert res.status_code == 200, res.data
        assert not Post.objects.filter(pk=post.pk).exists()

    def test_finder_can_read_their_own_found_report(self, finder, found_post):
        post = found_post()
        res = client_for(finder).get(f"/api/v1/posts/lost/{post.id}/")
        assert res.status_code == 200
        assert res.data["data"]["post_type"] == "FOUND"


@pytest.mark.django_db
class TestOtherUsers:
    def test_stranger_cannot_edit_or_withdraw(self, stranger, found_post):
        post = found_post(status=Post.Status.APPROVED)
        client = client_for(stranger)
        assert client.patch(f"/api/v1/posts/lost/{post.id}/", {"title": "x"}, format="json").status_code == 403
        assert client.delete(f"/api/v1/posts/lost/{post.id}/").status_code == 403
        assert Post.objects.filter(pk=post.pk, title="Found a key ring").exists()

    def test_private_found_report_stays_hidden_even_when_approved(self, stranger, found_post):
        post = found_post(status=Post.Status.APPROVED, inform_admin_privately=True)
        assert client_for(stranger).get(f"/api/v1/posts/lost/{post.id}/").status_code == 403

    def test_public_approved_found_report_is_readable_without_hidden_proof(self, stranger, found_post):
        post = found_post(status=Post.Status.APPROVED, hidden_proof="Tiny scratch on the brass key")
        res = client_for(stranger).get(f"/api/v1/posts/lost/{post.id}/")
        assert res.status_code == 200
        assert res.data["data"]["hidden_proof"] is None
