import pytest
from django.core.management import call_command
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from apps.posts.models import Category, SiteSettings, Post

User = get_user_model()

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
