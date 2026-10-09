"""
accounts/serializers/auth.py — Authentication, OTP, and registration serializers.
"""

from rest_framework import serializers
from apps.accounts.models import OTP, User, validate_iitrpr_email


class RequestOTPSerializer(serializers.Serializer):
    """Serializer to request an OTP code for registration or password reset."""
    email = serializers.EmailField()
    purpose = serializers.ChoiceField(choices=OTP.Purpose.choices, default=OTP.Purpose.REGISTRATION)

    def validate_email(self, value):
        email = value.lower().strip()
        validate_iitrpr_email(email)
        purpose = self.initial_data.get("purpose", OTP.Purpose.REGISTRATION)

        if purpose == OTP.Purpose.REGISTRATION:
            if User.objects.filter(email=email).exists():
                raise serializers.ValidationError("An account with this email already exists. Please log in.")
        elif purpose == OTP.Purpose.PASSWORD_RESET:
            if not User.objects.filter(email=email).exists():
                raise serializers.ValidationError("No registered account found with this email.")

        return email


class VerifyOTPSerializer(serializers.Serializer):
    """Serializer to verify a submitted 6-digit OTP code."""
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6, min_length=6)
    purpose = serializers.ChoiceField(choices=OTP.Purpose.choices, default=OTP.Purpose.REGISTRATION)

    def validate_email(self, value):
        return value.lower().strip()

    def validate_code(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("OTP code must contain only 6 digits.")
        return value


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer to complete student registration.
    Requires email, password, full_name, registration_number, department, program_year.
    """
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "password",
            "registration_number",
            "full_name",
            "department",
            "program_year",
            "hostel",
            "phone",
        ]
        read_only_fields = ["id"]

    def validate_email(self, value):
        email = value.lower().strip()
        validate_iitrpr_email(email)
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate_registration_number(self, value):
        return value.upper().strip()

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User.objects.create_user(
            password=password,
            is_email_verified=True,
            **validated_data
        )
        return user

