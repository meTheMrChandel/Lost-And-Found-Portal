import pytest
from django.core.management import call_command
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.posts.models import Category, SiteSettings, Post, PostImage

User = get_user_model()

@pytest.fixture
def client():
    return APIClient()

@pytest.fixture(autouse=True)
def seed_database():

    """Runs seed_data command before each test in the test database."""
    call_command("seed_data")

@pytest.mark.django_db
class TestPhase0Foundations:

    def test_seed_categories_exist(self):
        """Verify that all default categories are loaded properly."""
        expected_categories = [
            "bicycle", "phone", "laptop", "earbuds", "keys", 
            "id_card", "bottle", "umbrella", "wallet", "cash", "other"
        ]
        existing_categories = set(Category.objects.values_list("slug", flat=True))
        for slug in expected_categories:
            assert slug in existing_categories, f"Category '{slug}' should exist in seed data"

    def test_site_settings_singleton(self):
        """Verify SiteSettings singleton exists and has expected default values."""
        settings = SiteSettings.get()
        assert settings.match_threshold == 0.75
        assert settings.post_expiry_days == 30
        assert settings.otp_expiry_seconds == 300
        assert settings.otp_max_attempts == 3

    def test_valid_iitrpr_email_allowed(self):
        """User creation succeeds with a valid @iitrpr.ac.in email."""
        user = User.objects.create_user(
            email="2024csm1001@iitrpr.ac.in",
            registration_number="2024CSM1001",
            password="testpassword123",
            full_name="Valid Student"
        )
        assert user.email == "2024csm1001@iitrpr.ac.in"
        assert user.registration_number == "2024CSM1001"

    def test_invalid_email_domain_rejected(self):
        """User creation fails with non-iitrpr domain."""
        with pytest.raises(ValidationError):
            User.objects.create_user(
                email="student@gmail.com",
                registration_number="2024CSM1002",
                password="testpassword123",
                full_name="Invalid Domain Student"
            )

    def test_invalid_registration_number_rejected(self):
        """User creation fails with malformed registration number."""
        with pytest.raises(ValidationError):
            User.objects.create_user(
                email="student@iitrpr.ac.in",
                registration_number="INVALID_REG",
                password="testpassword123",
                full_name="Bad Reg Student"
            )

    def test_negative_reward_rejected(self):
        """Post rejects negative reward amount."""
        user = User.objects.create_user(
            email="tester@iitrpr.ac.in",
            registration_number="2024CSM1005",
            password="testpassword123",
            full_name="Reward Tester"
        )
        category = Category.objects.get(slug="keys")
        from django.utils import timezone

        post = Post(
            author=user,
            post_type=Post.PostType.LOST,
            category=category,
            title="Lost Keys",
            description="Room keys with blue ribbon",
            last_seen_place="Library",
            last_seen_time=timezone.now(),
            reward_amount=-100  # Negative reward
        )
        with pytest.raises(ValidationError):
            post.full_clean()


@pytest.mark.django_db
class TestPhase3LostItemReporting:
    """Test suite for Phase 3: Lost Item Reporting (User 1 flow)."""

    @pytest.fixture
    def student_user(self):
        return User.objects.create_user(
            email="student1@iitrpr.ac.in",
            registration_number="2024CSM1011",
            password="testpassword123",
            full_name="Student One",
        )

    @pytest.fixture
    def second_student(self):
        return User.objects.create_user(
            email="student2@iitrpr.ac.in",
            registration_number="2024CSM1012",
            password="testpassword123",
            full_name="Student Two",
        )

    @pytest.fixture
    def admin_user(self):
        return User.objects.create_superuser(
            email="admin@iitrpr.ac.in",
            password="adminpassword123",
            full_name="Campus Admin",
            registration_number="2024ADM0001",
        )

    def test_category_list_api(self, client):
        """Categories API returns list of categories accessible publicly."""
        res = client.get("/api/v1/posts/categories/")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) >= 11
        slugs = [c["slug"] for c in data]
        assert "keys" in slugs
        assert "laptop" in slugs

    def test_create_lost_post_success(self, client, student_user):
        """Student can submit a lost item report, resulting in PENDING status."""
        client.force_authenticate(user=student_user)
        payload = {
            "title": "Lost Blue Backpack",
            "category": "other",
            "description": "Wildcraft blue bag with laptop compartment",
            "last_seen_place": "Central Library, 1st Floor",
            "last_seen_time": "2026-10-18T10:00:00Z",
            "hidden_proof": "Inside pocket has a silver keychain with letter V",
            "reward_amount": "500.00",
        }
        res = client.post("/api/v1/posts/lost/", data=payload, format="json")
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["title"] == "Lost Blue Backpack"
        assert data["status"] == "PENDING"
        assert data["hidden_proof"] == "Inside pocket has a silver keychain with letter V"
        assert Post.objects.filter(id=data["id"], author=student_user).exists()

    def test_create_lost_post_validation(self, client, student_user):
        """Validates required fields, non-negative reward, and past/present last_seen_time."""
        client.force_authenticate(user=student_user)

        # Missing required fields
        res = client.post("/api/v1/posts/lost/", data={}, format="json")
        assert res.status_code == 400

        # Negative reward
        payload = {
            "title": "Lost Wallet",
            "category": "wallet",
            "description": "Black leather wallet",
            "last_seen_place": "Hostel cafeteria",
            "last_seen_time": "2026-10-18T10:00:00Z",
            "reward_amount": "-200.00",
        }
        res = client.post("/api/v1/posts/lost/", data=payload, format="json")
        assert res.status_code == 400

        # Future last seen time
        payload["reward_amount"] = "200.00"
        payload["last_seen_time"] = "2099-01-01T00:00:00Z"
        res = client.post("/api/v1/posts/lost/", data=payload, format="json")
        assert res.status_code == 400

    def test_image_upload_and_limit(self, client, student_user):
        """Verifies image attachments and enforcement of max 5 image limit."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        import io
        from PIL import Image

        client.force_authenticate(user=student_user)

        def make_test_image(name="test.jpg"):
            img = Image.new("RGB", (100, 100), color="blue")
            buf = io.BytesIO()
            img.save(buf, format="JPEG")
            return SimpleUploadedFile(name, buf.getvalue(), content_type="image/jpeg")

        # Valid 2 images upload
        data = {
            "title": "Lost Earbuds",
            "category": "earbuds",
            "description": "Sony black wireless earbuds",
            "last_seen_place": "SAC Gym",
            "last_seen_time": "2026-10-18T08:00:00Z",
            "images": [make_test_image("img1.jpg"), make_test_image("img2.jpg")],
        }
        res = client.post("/api/v1/posts/lost/", data=data, format="multipart")
        assert res.status_code == 201
        post_id = res.json()["data"]["id"]
        assert PostImage.objects.filter(post_id=post_id).count() == 2

        # Exceeding image limit (6 images)
        excess_data = {
            "title": "Lost Bicycle",
            "category": "bicycle",
            "description": "Hero Sprint red bicycle",
            "last_seen_place": "Brahmaputra Hostel",
            "last_seen_time": "2026-10-18T08:00:00Z",
            "images": [make_test_image(f"img{i}.jpg") for i in range(6)],
        }
        res = client.post("/api/v1/posts/lost/", data=excess_data, format="multipart")
        assert res.status_code == 400

    def test_hidden_proof_privacy(self, client, student_user, second_student, admin_user):
        """Confidential hidden_proof is visible to author and admin, never to other students."""
        post = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=Category.objects.get(slug="laptop"),
            title="Lost MacBook Pro",
            description="Silver 14-inch MacBook",
            last_seen_place="Admin Block 204",
            last_seen_time="2026-10-18T10:00:00Z",
            hidden_proof="Small apple sticker on bottom chassis near vents",
            status=Post.Status.PENDING,
        )

        # 1. Author can see hidden proof
        client.force_authenticate(user=student_user)
        res = client.get(f"/api/v1/posts/lost/{post.id}/")
        assert res.status_code == 200
        assert res.json()["data"]["hidden_proof"] == "Small apple sticker on bottom chassis near vents"

        # 2. Admin can see hidden proof
        client.force_authenticate(user=admin_user)
        res = client.get(f"/api/v1/posts/lost/{post.id}/")
        assert res.status_code == 200
        assert res.json()["data"]["hidden_proof"] == "Small apple sticker on bottom chassis near vents"

        # 3. Another student cannot access non-approved post
        client.force_authenticate(user=second_student)
        res = client.get(f"/api/v1/posts/lost/{post.id}/")
        assert res.status_code == 403

    def test_my_reports_only_returns_own_posts(self, client, student_user, second_student):
        """My reports returns strictly posts authored by the requesting student."""
        category = Category.objects.get(slug="keys")
        p1 = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=category,
            title="Student 1 Keys",
            description="Keys",
            last_seen_place="Hostel",
            last_seen_time="2026-10-18T10:00:00Z",
        )
        p2 = Post.objects.create(
            author=second_student,
            post_type=Post.PostType.LOST,
            category=category,
            title="Student 2 Keys",
            description="Keys",
            last_seen_place="Hostel",
            last_seen_time="2026-10-18T10:00:00Z",
        )

        client.force_authenticate(user=student_user)
        res = client.get("/api/v1/posts/lost/my-reports/")
        assert res.status_code == 200
        post_ids = [item["id"] for item in res.json()["data"]]
        assert str(p1.id) in post_ids
        assert str(p2.id) not in post_ids

    def test_banned_user_cannot_create_lost_post(self, client, student_user):
        """Banned users are blocked from submitting lost reports."""
        student_user.is_banned = True
        student_user.save()

        client.force_authenticate(user=student_user)
        payload = {
            "title": "Banned User Item",
            "category": "other",
            "description": "Test",
            "last_seen_place": "Campus",
            "last_seen_time": "2026-10-18T10:00:00Z",
        }
        res = client.post("/api/v1/posts/lost/", data=payload, format="json")
        assert res.status_code == 403


@pytest.mark.django_db
class TestPhase5FeedAndFoundReports:
    """Test suite for Phase 5: Public Feed, Found Item Reports, and Abuse Reporting."""

    @pytest.fixture
    def student_user(self):
        return User.objects.create_user(
            email="finder.student@iitrpr.ac.in",
            registration_number="2024CSM1020",
            password="testpassword123",
            full_name="Finder Student",
        )

    @pytest.fixture
    def other_student(self):
        return User.objects.create_user(
            email="other.student@iitrpr.ac.in",
            registration_number="2024CSM1021",
            password="testpassword123",
            full_name="Other Student",
        )

    def test_found_post_creation_success(self, client, student_user):
        """Student can submit a found item report with custody location."""
        client.force_authenticate(user=student_user)
        payload = {
            "title": "Found Water Bottle",
            "category": "bottle",
            "description": "Milton black insulated bottle with IIT sticker",
            "last_seen_place": "LHC 101 front row",
            "last_seen_time": "2026-10-20T12:00:00Z",
            "custody_location": "finder",
            "inform_admin_privately": False,
        }
        res = client.post("/api/v1/posts/found/", data=payload, format="json")
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["title"] == "Found Water Bottle"
        assert data["post_type"] == "FOUND"
        assert data["status"] == "PENDING"
        assert Post.objects.filter(id=data["id"], custody_location="finder").exists()

    def test_found_post_with_private_admin_disclosure(self, client, student_user):
        """Student can flag a found item to inform admin privately."""
        client.force_authenticate(user=student_user)
        payload = {
            "title": "Found Expensive Earbuds",
            "category": "earbuds",
            "description": "Found near main gate",
            "last_seen_place": "Main Gate Security",
            "last_seen_time": "2026-10-20T12:00:00Z",
            "custody_location": "security_office",
            "inform_admin_privately": True,
        }
        res = client.post("/api/v1/posts/found/", data=payload, format="json")
        assert res.status_code == 201
        post = Post.objects.get(id=res.json()["data"]["id"])
        assert post.inform_admin_privately is True
        assert post.is_public is False

    def test_feed_only_shows_approved_posts(self, client, student_user):
        """Public feed only includes approved posts."""
        cat = Category.objects.get(slug="umbrella")
        pending_post = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.FOUND,
            category=cat,
            title="Pending Umbrella",
            description="Blue umbrella",
            last_seen_place="Cafeteria",
            last_seen_time="2026-10-20T10:00:00Z",
            status=Post.Status.PENDING,
        )
        approved_post = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.FOUND,
            category=cat,
            title="Approved Umbrella",
            description="Blue umbrella",
            last_seen_place="Cafeteria",
            last_seen_time="2026-10-20T10:00:00Z",
            status=Post.Status.APPROVED,
        )

        res = client.get("/api/v1/posts/feed/")
        assert res.status_code == 200
        feed_ids = [p["id"] for p in res.json()["data"]]
        assert str(approved_post.id) in feed_ids
        assert str(pending_post.id) not in feed_ids

    def test_feed_excludes_sensitive_categories(self, client, student_user):
        """Sensitive categories (wallet, cash) never appear in the public feed."""
        wallet_cat = Category.objects.get(slug="wallet")
        assert wallet_cat.is_sensitive is True

        sensitive_post = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.FOUND,
            category=wallet_cat,
            title="Found Brown Leather Wallet",
            description="Found wallet containing cards",
            last_seen_place="Library",
            last_seen_time="2026-10-20T10:00:00Z",
            status=Post.Status.APPROVED,
        )

        res = client.get("/api/v1/posts/feed/")
        assert res.status_code == 200
        feed_ids = [p["id"] for p in res.json()["data"]]
        assert str(sensitive_post.id) not in feed_ids

    def test_feed_filtering_and_search(self, client, student_user):
        """Public feed filters by category, post_type, and search keyword."""
        cat_keys = Category.objects.get(slug="keys")
        cat_phone = Category.objects.get(slug="phone")

        p_keys = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=cat_keys,
            title="Lost Hostel Room 102 Key",
            description="Silver key with blue ring",
            last_seen_place="Satluj Hostel",
            last_seen_time="2026-10-20T09:00:00Z",
            status=Post.Status.APPROVED,
        )
        p_phone = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.FOUND,
            category=cat_phone,
            title="Found Samsung Galaxy S23",
            description="Green phone with clear cover",
            last_seen_place="Lecture Hall 2",
            last_seen_time="2026-10-20T09:00:00Z",
            status=Post.Status.APPROVED,
        )

        # Filter by category
        res_keys = client.get("/api/v1/posts/feed/?category=keys")
        assert res_keys.status_code == 200
        keys_ids = [p["id"] for p in res_keys.json()["data"]]
        assert str(p_keys.id) in keys_ids
        assert str(p_phone.id) not in keys_ids

        # Filter by post_type
        res_found = client.get("/api/v1/posts/feed/?post_type=FOUND")
        assert res_found.status_code == 200
        found_ids = [p["id"] for p in res_found.json()["data"]]
        assert str(p_phone.id) in found_ids
        assert str(p_keys.id) not in found_ids

        # Search query
        res_search = client.get("/api/v1/posts/feed/?search=Samsung")
        assert res_search.status_code == 200
        search_ids = [p["id"] for p in res_search.json()["data"]]
        assert str(p_phone.id) in search_ids
        assert str(p_keys.id) not in search_ids

        # Mobile param format: type=lost & category=all
        res_mobile = client.get("/api/v1/posts/feed/?type=lost&category=all")
        assert res_mobile.status_code == 200
        mobile_ids = [p["id"] for p in res_mobile.json()["data"]]
        assert str(p_keys.id) in mobile_ids
        assert str(p_phone.id) not in mobile_ids

    def test_student_can_report_abuse(self, client, student_user, other_student):
        """Student can report abuse on a post; duplicate reporting is prevented."""
        cat = Category.objects.get(slug="bottle")
        post = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.FOUND,
            category=cat,
            title="Test Bottle",
            description="Test",
            last_seen_place="Campus",
            last_seen_time="2026-10-20T10:00:00Z",
            status=Post.Status.APPROVED,
        )

        client.force_authenticate(user=other_student)
        payload = {"reason": "spam", "description": "Obvious test post"}
        res = client.post(f"/api/v1/posts/{post.id}/report-abuse/", data=payload, format="json")
        assert res.status_code == 201

        # Duplicate attempt fails
        res_dup = client.post(f"/api/v1/posts/{post.id}/report-abuse/", data=payload, format="json")
        assert res_dup.status_code == 400

    def test_author_can_renew_post(self, client, student_user, other_student):
        """Author can renew active post; unauthorized student is blocked."""
        cat = Category.objects.get(slug="bicycle")
        post = Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=cat,
            title="My Bicycle",
            description="Bicycle description",
            last_seen_place="Brahmaputra",
            last_seen_time="2026-10-20T10:00:00Z",
            status=Post.Status.APPROVED,
        )

        # Other student cannot renew
        client.force_authenticate(user=other_student)
        res_fail = client.post(f"/api/v1/posts/{post.id}/renew/")
        assert res_fail.status_code == 403

        # Author can renew
        client.force_authenticate(user=student_user)
        res_success = client.post(f"/api/v1/posts/{post.id}/renew/")
        assert res_success.status_code == 200
        post.refresh_from_db()
        assert post.renewed_at is not None

    def test_upload_mime_binary_magic_bytes_validation(self, client, student_user):
        """Files with spoofed image content-type but invalid binary signatures are rejected."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        client.force_authenticate(user=student_user)

        # 1. Spoofed executable/script pretending to be an image
        fake_image = SimpleUploadedFile(
            name="malicious.jpg",
            content=b"#!/usr/bin/env python\nimport os\nprint('pwned')",
            content_type="image/jpeg",
        )
        payload = {
            "title": "Lost Wallet with Fake Image",
            "category": "bicycle",
            "last_seen_place": "Hostel",
            "last_seen_time": "2026-10-20T10:00:00Z",
            "description": "Lost bike description with spoofed image",
            "images": [fake_image],
        }
        res_spoofed = client.post("/api/v1/posts/lost/", data=payload, format="multipart")
        assert res_spoofed.status_code == 400
        assert "invalid image binary signature" in str(res_spoofed.data).lower()

        # 2. Genuine PNG binary file header
        genuine_png = SimpleUploadedFile(
            name="valid.png",
            content=b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01",
            content_type="image/png",
        )
        payload["images"] = [genuine_png]
        res_valid = client.post("/api/v1/posts/lost/", data=payload, format="multipart")
        assert res_valid.status_code == 201


