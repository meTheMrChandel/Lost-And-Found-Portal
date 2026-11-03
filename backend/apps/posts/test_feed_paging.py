"""
posts/test_feed_paging.py — Opt-in paging on the public feed. Without page_size the
full list is returned unchanged, which the mobile app and home page rely on.
"""

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.posts.models import Category, Post


@pytest.fixture
def feed(db):
    call_command("seed_data")
    author = User.objects.create_user(
        email="paging.author@iitrpr.ac.in", registration_number="2024CSM1500", password="TestPassword123", full_name="P"
    )
    category = Category.objects.filter(is_sensitive=False).first()
    created = timezone.now()
    for i in range(7):
        post = Post.objects.create(
            author=author, post_type=Post.PostType.LOST, category=category, title=f"Item {i}",
            description="d", last_seen_place="Library", last_seen_time=created - timedelta(days=1),
            status=Post.Status.APPROVED,
        )
        # Several posts share a timestamp, so ordering must still be stable across pages
        Post.objects.filter(pk=post.pk).update(created_at=created - timedelta(minutes=i // 3))
    return APIClient()


@pytest.mark.django_db
class TestFeedPaging:
    def test_without_page_size_the_full_list_is_returned(self, feed):
        res = feed.get("/api/v1/posts/feed/?include_pending=false")
        assert res.status_code == 200
        assert len(res.data["data"]) == 7
        assert "pagination" not in res.data

    def test_pages_cover_every_post_exactly_once(self, feed):
        seen, page = [], 1
        while True:
            res = feed.get(f"/api/v1/posts/feed/?include_pending=false&page_size=3&page={page}")
            assert res.status_code == 200
            seen += [p["id"] for p in res.data["data"]]
            meta = res.data["pagination"]
            assert meta["total"] == 7 and meta["page"] == page
            if not meta["has_next"]:
                break
            page += 1
        assert page == 3
        assert len(seen) == 7 and len(set(seen)) == 7

    def test_page_past_the_end_is_empty(self, feed):
        res = feed.get("/api/v1/posts/feed/?include_pending=false&page_size=3&page=9")
        assert res.data["data"] == [] and res.data["pagination"]["has_next"] is False

    def test_page_size_is_capped(self, feed):
        res = feed.get("/api/v1/posts/feed/?include_pending=false&page_size=1000")
        assert res.data["pagination"]["page_size"] == 50

    def test_bad_numbers_are_rejected(self, feed):
        assert feed.get("/api/v1/posts/feed/?page_size=abc").status_code == 400
        assert feed.get("/api/v1/posts/feed/?page_size=5&page=x").status_code == 400
