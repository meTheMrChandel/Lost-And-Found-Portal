"""
posts/views.py — API views for Category listing, Lost Post reporting, and My Reports.
"""

from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.accounts.permissions import IsNotBanned, IsOwnerOrAdmin
from apps.posts.models import Category, Post, PostImage
from apps.posts.serializers import (
    CategorySerializer,
    LostPostCreateSerializer,
    LostPostDetailSerializer,
    LostPostListSerializer,
    LostPostUpdateSerializer,
)

MAX_IMAGES_ALLOWED = 5
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"]


def _process_uploaded_images(post: Post, files: list) -> list:
    """Validate and attach uploaded images to a post."""
    if len(files) > MAX_IMAGES_ALLOWED:
        raise ValidationError(f"Maximum of {MAX_IMAGES_ALLOWED} photos can be attached.")

    saved_images = []
    for order, f in enumerate(files):
        if f.size > MAX_IMAGE_SIZE_BYTES:
            raise ValidationError(f"Image '{f.name}' exceeds the 5MB size limit.")
        if f.content_type not in ALLOWED_CONTENT_TYPES:
            raise ValidationError(
                f"File '{f.name}' is not an accepted image format (JPG, PNG, WEBP)."
            )

        post_img = PostImage.objects.create(
            post=post,
            image=f,
            order=order,
        )
        saved_images.append(post_img)
    return saved_images


class CategoryListView(APIView):
    """
    GET /api/v1/posts/categories/
    Retrieve all available item categories sorted by display order.
    """

    permission_classes = [AllowAny]

    @extend_schema(responses={200: CategorySerializer(many=True)})
    def get(self, request):
        categories = Category.objects.all().order_by("order", "name")
        serializer = CategorySerializer(categories, many=True)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)


class LostPostCreateView(APIView):
    """
    POST /api/v1/posts/lost/
    Submit a lost item report to campus administration.
    Creates post in PENDING status awaiting administrative verification.
    """

    permission_classes = [IsAuthenticated, IsNotBanned]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        request=LostPostCreateSerializer,
        responses={201: LostPostDetailSerializer},
    )
    def post(self, request):
        serializer = LostPostCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Validate images before creating post
        images = request.FILES.getlist("images")
        if len(images) > MAX_IMAGES_ALLOWED:
            raise ValidationError(f"Maximum of {MAX_IMAGES_ALLOWED} photos can be attached.")

        for f in images:
            if f.size > MAX_IMAGE_SIZE_BYTES:
                raise ValidationError(f"Image '{f.name}' exceeds the 5MB size limit.")
            if f.content_type not in ALLOWED_CONTENT_TYPES:
                raise ValidationError(
                    f"File '{f.name}' is not an accepted image format (JPG, PNG, WEBP)."
                )

        post = serializer.save(
            author=request.user,
            post_type=Post.PostType.LOST,
            status=Post.Status.PENDING,
        )

        # Attach images
        if images:
            _process_uploaded_images(post, images)

        response_serializer = LostPostDetailSerializer(post, context={"request": request})
        return Response(
            {
                "success": True,
                "message": "Lost item report submitted successfully. Awaiting campus admin review.",
                "data": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class MyReportsListView(APIView):
    """
    GET /api/v1/posts/my/ & GET /api/v1/posts/lost/my-reports/
    Retrieve all reports submitted by the authenticated student.
    """

    permission_classes = [IsAuthenticated, IsNotBanned]

    @extend_schema(
        parameters=[
            OpenApiParameter(name="status", description="Filter by post status", required=False, type=str),
            OpenApiParameter(name="category", description="Filter by category slug", required=False, type=str),
            OpenApiParameter(name="post_type", description="Filter by post type (LOST/FOUND)", required=False, type=str),
        ],
        responses={200: LostPostListSerializer(many=True)},
    )
    def get(self, request):
        posts = (
            Post.objects.filter(author=request.user)
            .select_related("category")
            .prefetch_related("images")
            .order_by("-created_at")
        )

        status_param = request.query_params.get("status")
        if status_param:
            posts = posts.filter(status=status_param.upper())

        category_param = request.query_params.get("category")
        if category_param:
            posts = posts.filter(category_id=category_param)

        post_type_param = request.query_params.get("post_type")
        if post_type_param:
            posts = posts.filter(post_type=post_type_param.upper())

        serializer = LostPostListSerializer(posts, many=True)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)


class LostPostDetailView(APIView):
    """
    GET /api/v1/posts/lost/<id>/ — View lost item report details.
    PATCH /api/v1/posts/lost/<id>/ — Edit report (Author only, when PENDING or INFO_REQUESTED).
    DELETE /api/v1/posts/lost/<id>/ — Withdraw report (Author or Admin).
    """

    permission_classes = [IsAuthenticated, IsNotBanned]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, pk, user):
        try:
            post = (
                Post.objects.select_related("category", "author")
                .prefetch_related("images")
                .get(pk=pk, post_type=Post.PostType.LOST)
            )
        except Post.DoesNotExist:
            raise ValidationError("Post does not exist.")

        # Access check: Author, Admin, or Approved public post
        if post.author != user and not (user.is_staff or user.is_superuser):
            if post.status != Post.Status.APPROVED or post.category.is_sensitive:
                raise PermissionDenied("You do not have permission to view this report.")

        return post

    @extend_schema(responses={200: LostPostDetailSerializer})
    def get(self, request, pk):
        post = self.get_object(pk, request.user)
        serializer = LostPostDetailSerializer(post, context={"request": request})
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)

    @extend_schema(
        request=LostPostUpdateSerializer,
        responses={200: LostPostDetailSerializer},
    )
    def patch(self, request, pk):
        post = self.get_object(pk, request.user)

        # Only author can edit report
        if post.author != request.user and not (request.user.is_staff or request.user.is_superuser):
            raise PermissionDenied("Only the author or an administrator can edit this report.")

        if post.status not in [Post.Status.PENDING, Post.Status.INFO_REQUESTED] and not (
            request.user.is_staff or request.user.is_superuser
        ):
            raise ValidationError(
                f"Cannot edit report in status '{post.get_status_display()}'."
            )

        serializer = LostPostUpdateSerializer(post, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_post = serializer.save()

        # Handle optional new image attachments
        new_images = request.FILES.getlist("images")
        if new_images:
            existing_count = post.images.count()
            if existing_count + len(new_images) > MAX_IMAGES_ALLOWED:
                raise ValidationError(
                    f"Post already has {existing_count} photos. Total cannot exceed {MAX_IMAGES_ALLOWED}."
                )
            _process_uploaded_images(post, new_images)

        response_serializer = LostPostDetailSerializer(
            updated_post, context={"request": request}
        )
        return Response(
            {
                "success": True,
                "message": "Lost item report updated successfully.",
                "data": response_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        post = self.get_object(pk, request.user)

        # Only author or staff can delete
        if post.author != request.user and not (request.user.is_staff or request.user.is_superuser):
            raise PermissionDenied("You do not have permission to withdraw this report.")

        post.delete()
        return Response(
            {"success": True, "message": "Report has been withdrawn and removed."},
            status=status.HTTP_200_OK,
        )
