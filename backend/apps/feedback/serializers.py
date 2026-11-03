from rest_framework import serializers

from apps.feedback.models import Feedback


class FeedbackCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = ["rating", "message", "page"]
        extra_kwargs = {"message": {"allow_blank": False}}


class FeedbackSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True, default=None)
    user_email = serializers.EmailField(source="user.email", read_only=True, default=None)

    class Meta:
        model = Feedback
        fields = ["id", "rating", "message", "page", "user_name", "user_email", "created_at"]
