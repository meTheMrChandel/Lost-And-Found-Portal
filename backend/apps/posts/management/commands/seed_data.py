"""
Management command: python manage.py seed_data

Seeds the database with:
  1. Default categories (from the implementation plan)
  2. Default SiteSettings singleton
  3. A superuser (if none exists) for local dev
"""

from django.core.management.base import BaseCommand
from django.db import transaction


CATEGORIES = [
    {"slug": "bicycle",   "name": "Bicycle",    "is_sensitive": False, "icon": "🚲", "order": 1},
    {"slug": "phone",     "name": "Phone",      "is_sensitive": False, "icon": "📱", "order": 2},
    {"slug": "laptop",    "name": "Laptop",     "is_sensitive": False, "icon": "💻", "order": 3},
    {"slug": "earbuds",   "name": "Earbuds",    "is_sensitive": False, "icon": "🎧", "order": 4},
    {"slug": "keys",      "name": "Keys",       "is_sensitive": False, "icon": "🔑", "order": 5},
    {"slug": "id_card",   "name": "ID Card",    "is_sensitive": False, "icon": "🪪", "order": 6},
    {"slug": "bottle",    "name": "Bottle",     "is_sensitive": False, "icon": "🍶", "order": 7},
    {"slug": "umbrella",  "name": "Umbrella",   "is_sensitive": False, "icon": "☂️",  "order": 8},
    {"slug": "wallet",    "name": "Wallet",     "is_sensitive": True,  "icon": "👛", "order": 9},
    {"slug": "cash",      "name": "Cash",       "is_sensitive": True,  "icon": "💵", "order": 10},
    {"slug": "other",     "name": "Other",      "is_sensitive": False, "icon": "📦", "order": 11},
]


class Command(BaseCommand):
    help = "Seed the database with categories, site settings, and a dev superuser."

    @transaction.atomic
    def handle(self, *args, **options):
        self._seed_categories()
        self._seed_site_settings()
        self._seed_superuser()

    def _seed_categories(self):
        from apps.posts.models import Category

        created_count = 0
        for cat_data in CATEGORIES:
            _, created = Category.objects.update_or_create(
                slug=cat_data["slug"],
                defaults={
                    "name": cat_data["name"],
                    "is_sensitive": cat_data["is_sensitive"],
                    "icon": cat_data["icon"],
                    "order": cat_data["order"],
                },
            )
            if created:
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Categories: {created_count} created, {len(CATEGORIES) - created_count} already existed."
            )
        )

    def _seed_site_settings(self):
        from apps.posts.models import SiteSettings

        settings_obj = SiteSettings.get()
        self.stdout.write(
            self.style.SUCCESS(
                f"SiteSettings: match_threshold={settings_obj.match_threshold}, "
                f"post_expiry_days={settings_obj.post_expiry_days}"
            )
        )

    def _seed_superuser(self):
        from django.contrib.auth import get_user_model

        User = get_user_model()

        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write("Superuser already exists — skipping.")
            return

        # Create a dev superuser only in DEBUG mode
        from django.conf import settings
        if not settings.DEBUG:
            self.stdout.write("Not DEBUG — skipping dev superuser creation.")
            return

        email = "admin@iitrpr.ac.in"
        reg = "2024ADM0001"
        password = "admin1234"

        User.objects.create_superuser(
            email=email,
            registration_number=reg,
            password=password,
            full_name="Portal Admin",
            is_email_verified=True,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Dev superuser created: {email} / {password} (reg: {reg})"
            )
        )
