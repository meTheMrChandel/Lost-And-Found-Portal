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

