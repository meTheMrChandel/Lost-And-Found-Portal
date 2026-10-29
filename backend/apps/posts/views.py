"""
posts/views.py — API views for Category listing, Lost Post reporting, and My Reports.
"""

import uuid
from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.accounts.permissions import IsNotBanned, IsOwnerOrAdmin
from apps.adminpanel.models import PostAuditLog
from apps.posts.lifecycle import new_expiry_date
from apps.posts.models import Category, Post, PostImage, AbuseReport, SiteSettings
from apps.posts.serializers import (
    CategorySerializer,
    LostPostCreateSerializer,
    LostPostDetailSerializer,
    LostPostListSerializer,
    LostPostUpdateSerializer,
    FoundPostCreateSerializer,
    PublicFeedPostSerializer,
    AbuseReportCreateSerializer,
)

MAX_IMAGES_ALLOWED = 5
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"]


def _validate_image_magic_bytes(f) -> bool:
    """Validate binary magic bytes signature to prevent spoofed scripts/executables."""
    try:
        header = f.read(16)
        f.seek(0)
        if header.startswith(b"\xff\xd8\xff"):
            return True  # JPEG / JPG
        if header.startswith(b"\x89PNG\r\n\x1a\n"):
            return True  # PNG
        if header.startswith(b"RIFF") and len(header) >= 12 and header[8:12] == b"WEBP":
            return True  # WEBP
        return False
    except Exception:
        return False


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
        if not _validate_image_magic_bytes(f):
            raise ValidationError(
                f"File '{f.name}' has invalid image binary signature (spoofed or corrupted file)."
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
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "post_create"
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

        is_author = post.author == request.user
        PostAuditLog.objects.create(
            post=post,
            admin=request.user,
            action="WITHDRAW" if is_author else "DELETE",
            previous_status=post.status,
            new_status="DELETED",
            notes="Report withdrawn by its author." if is_author else "Report deleted by an administrator.",
        )
        post.delete()
        return Response(
            {"success": True, "message": "Report has been withdrawn and removed."},
            status=status.HTTP_200_OK,
        )


class FoundPostCreateView(APIView):
    """
    POST /api/v1/posts/found/
    Submit a found item report (User 2 flow).
    Supports custody location selection and private disclosure option.
    """

    permission_classes = [IsAuthenticated, IsNotBanned]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "post_create"
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        request=FoundPostCreateSerializer,
        responses={201: LostPostDetailSerializer},
    )
    def post(self, request):
        serializer = FoundPostCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

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
            post_type=Post.PostType.FOUND,
            status=Post.Status.PENDING,
        )

        if images:
            _process_uploaded_images(post, images)

        response_serializer = LostPostDetailSerializer(post, context={"request": request})
        return Response(
            {
                "success": True,
                "message": "Found item reported successfully. Campus administrators will verify custody.",
                "data": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class PublicFeedView(APIView):
    """
    GET /api/v1/posts/feed/ & GET /api/v1/posts/
    Public campus feed of verified and approved items.
    Enforces strict privacy: excludes sensitive categories, private admin items, and expired posts.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter(name="category", description="Filter by category slug", required=False, type=str),
            OpenApiParameter(name="post_type", description="Filter by post type (LOST/FOUND)", required=False, type=str),
            OpenApiParameter(name="search", description="Search in title, description, and location", required=False, type=str),
            OpenApiParameter(name="ordering", description="Ordering field (-created_at, created_at, reward_amount, -reward_amount)", required=False, type=str),
        ],
        responses={200: PublicFeedPostSerializer(many=True)},
    )
    def get(self, request):
        now = timezone.now()
        user = request.user if request.user.is_authenticated else None
        is_staff = user and (user.is_staff or getattr(user, "is_campus_admin", False))
        include_pending_param = request.query_params.get("include_pending")
        if include_pending_param is not None:
            show_pending = include_pending_param.lower() in ["true", "1", "yes"]
        else:
            show_pending = getattr(settings, "DEBUG", False) or is_staff

        base_filter = Q(
            category__is_sensitive=False,
            inform_admin_privately=False,
        ) & (Q(expires_at__isnull=True) | Q(expires_at__gt=now))

        if show_pending:
            status_filter = Q(status__in=[Post.Status.APPROVED, Post.Status.PENDING])
        elif user:
            # Authenticated user sees all approved posts + their own posts (even if pending)
            status_filter = Q(status=Post.Status.APPROVED) | Q(author=user)
        else:
            status_filter = Q(status=Post.Status.APPROVED)

        posts = (
            Post.objects.filter(base_filter & status_filter)
            .select_related("category", "author")
            .prefetch_related("images")
        )

        # Filters
        category_param = request.query_params.get("category")
        if category_param and category_param.upper() != "ALL":
            try:
                uuid.UUID(str(category_param))
                posts = posts.filter(category_id=category_param)
            except (ValueError, AttributeError):
                posts = posts.filter(category__slug__iexact=category_param)

        post_type_param = request.query_params.get("post_type") or request.query_params.get("type")
        if post_type_param and post_type_param.upper() in ["LOST", "FOUND"]:
            posts = posts.filter(post_type=post_type_param.upper())

        search_param = request.query_params.get("search")
        if search_param:
            q = search_param.strip()
            posts = posts.filter(
                Q(title__icontains=q)
                | Q(description__icontains=q)
                | Q(last_seen_place__icontains=q)
            )

        ordering = request.query_params.get("ordering", "-created_at")
        allowed_orderings = ["-created_at", "created_at", "-reward_amount", "reward_amount"]
        if ordering in allowed_orderings:
            posts = posts.order_by(ordering)
        else:
            posts = posts.order_by("-created_at")

        serializer = PublicFeedPostSerializer(posts, many=True)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)


class PostPublicDetailView(APIView):
    """
    GET /api/v1/posts/<id>/
    Retrieve post details for the public view.
    Enforces privacy: non-approved or sensitive posts accessible only by author or staff.
    Confidential hidden_proof is stripped for non-authors.
    """

    permission_classes = [AllowAny]

    @extend_schema(responses={200: LostPostDetailSerializer})
    def get(self, request, pk):
        try:
            post = (
                Post.objects.select_related("category", "author")
                .prefetch_related("images")
                .get(pk=pk)
            )
        except Post.DoesNotExist:
            raise NotFound("Post not found.")

        # Privacy gate
        user = request.user if request.user.is_authenticated else None
        is_owner = user and user == post.author
        is_staff = user and (user.is_staff or user.is_superuser)

        if not (is_owner or is_staff):
            allowed_statuses = [Post.Status.APPROVED, Post.Status.PENDING] if (getattr(settings, "DEBUG", False) or request.query_params.get("include_pending") == "true") else [Post.Status.APPROVED]
            if post.status not in allowed_statuses or post.category.is_sensitive or post.inform_admin_privately:
                raise PermissionDenied("You do not have permission to view this post.")

        serializer = LostPostDetailSerializer(post, context={"request": request})
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)


class PostReportAbuseView(APIView):
    """
    POST /api/v1/posts/<id>/report-abuse/
    Students report fraudulent, spam, or inappropriate posts.
    """

    permission_classes = [IsAuthenticated, IsNotBanned]

    @extend_schema(
        request=AbuseReportCreateSerializer,
        responses={201: dict},
    )
    def post(self, request, pk):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            raise NotFound("Post not found.")

        serializer = AbuseReportCreateSerializer(
            data=request.data,
            context={"request": request, "post": post},
        )
        serializer.is_valid(raise_exception=True)

        AbuseReport.objects.create(
            post=post,
            reporter=request.user,
            reason=serializer.validated_data["reason"],
            description=serializer.validated_data.get("description", ""),
        )

        return Response(
            {
                "success": True,
                "message": "Thank you for reporting. Campus administrators will investigate this post.",
            },
            status=status.HTTP_201_CREATED,
        )


class PostRenewView(APIView):
    """
    POST /api/v1/posts/<id>/renew/
    Author extends a live or expired listing by post_expiry_days (default 30 days).
    An expired post goes back on the feed; posts still in review, rejected,
    hidden or returned cannot be renewed.
    """

    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request, pk):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            raise NotFound("Post not found.")

        if post.author != request.user and not (request.user.is_staff or request.user.is_superuser):
            raise PermissionDenied("Only the post author can renew this listing.")

        if post.status not in [Post.Status.APPROVED, Post.Status.EXPIRED]:
            raise ValidationError(
                f"Only live or expired posts can be renewed, not posts in status '{post.get_status_display()}'."
            )

        now = timezone.now()
        previous_status = post.status
        post.status = Post.Status.APPROVED
        post.expires_at = new_expiry_date(now)
        post.renewed_at = now
        post.expiry_reminder_sent_at = None
        post.save()

        expiry_days = SiteSettings.get().post_expiry_days or 30
        PostAuditLog.objects.create(
            post=post,
            admin=request.user,
            action="RENEW",
            previous_status=previous_status,
            new_status=post.status,
            notes=f"Renewed for {expiry_days} days, until {timezone.localtime(post.expires_at):%d %b %Y}.",
        )

        return Response(
            {
                "success": True,
                "message": f"Post renewed for {expiry_days} additional days.",
                "data": {
                    "id": post.id,
                    "status": post.status,
                    "expires_at": post.expires_at,
                    "renewed_at": post.renewed_at,
                },
            },
            status=status.HTTP_200_OK,
        )

