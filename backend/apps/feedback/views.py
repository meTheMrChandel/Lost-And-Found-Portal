"""
feedback/views.py
POST /api/v1/feedback/ — any signed-in user sends feedback.
GET  /api/v1/feedback/ — admins read it, newest first, with the average rating.
"""

from django.db.models import Avg
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.accounts.permissions import IsCampusAdmin, IsNotBanned
from apps.feedback.models import Feedback
from apps.feedback.serializers import FeedbackCreateSerializer, FeedbackSerializer


class FeedbackView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [IsCampusAdmin()]
        return [IsAuthenticated(), IsNotBanned()]

    @extend_schema(responses={200: FeedbackSerializer(many=True)})
    def get(self, request):
        entries = Feedback.objects.select_related("user")
        average = entries.aggregate(avg=Avg("rating"))["avg"]
        return Response(
            {
                "success": True,
                "data": FeedbackSerializer(entries, many=True).data,
                "summary": {"count": entries.count(), "average_rating": round(average, 1) if average else None},
            }
        )

    @extend_schema(request=FeedbackCreateSerializer, responses={201: dict})
    def post(self, request):
        serializer = FeedbackCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(
            {"success": True, "message": "Thanks for your feedback. It goes straight to the portal team."},
            status=status.HTTP_201_CREATED,
        )
