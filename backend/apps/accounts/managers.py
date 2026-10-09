"""Custom UserManager for the accounts.User model."""

from django.contrib.auth.models import BaseUserManager
from django.utils.translation import gettext_lazy as _


class UserManager(BaseUserManager):
    """Manager that uses email as the unique identifier."""

    def _create_user(self, email: str, registration_number: str, password: str, **extra_fields):
        if not email:
            raise ValueError(_("The email address must be set."))
        if not registration_number:
            raise ValueError(_("The registration number must be set."))
        email = self.normalize_email(email).lower()
        registration_number = registration_number.upper()
        user = self.model(email=email, registration_number=registration_number, **extra_fields)
        user.set_password(password)
        user.full_clean()
        user.save(using=self._db)
        return user

    def create_user(self, email: str, registration_number: str, password: str = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, registration_number, password, **extra_fields)

    def create_superuser(self, email: str, registration_number: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_email_verified", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("Superuser must have is_staff=True."))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("Superuser must have is_superuser=True."))

        return self._create_user(email, registration_number, password, **extra_fields)
