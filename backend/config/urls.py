"""Root URL configuration for the Lost & Found Portal API."""

from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from config.views import AppConfigView, HealthView, landing_page_view

urlpatterns = [
    # Root landing page (http://127.0.0.1:8000/)
    path("", landing_page_view, name="landing-page"),

    # Django admin
    # Not /admin/: that path belongs to the web app's admin portal (see docker/nginx/nginx.conf)
    path("django-admin/", admin.site.urls),

    # API v1
    path("api/v1/health/", HealthView.as_view(), name="health"),
    path("api/v1/app-config/", AppConfigView.as_view(), name="app-config"),
    path("api/v1/auth/", include("apps.accounts.urls.auth")),
    path("api/v1/users/", include("apps.accounts.urls.users")),
    path("api/v1/posts/", include("apps.posts.urls")),
    path("api/v1/matching/", include("apps.matching.urls")),
    path("api/v1/items/", include("apps.items.urls")),
    path("api/v1/chat/", include("apps.chat.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/feedback/", include("apps.feedback.urls")),
    path("api/v1/admin/", include("apps.adminpanel.urls")),
    path("api/v1/adminpanel/", include("apps.adminpanel.urls")),

    # OpenAPI schema + docs
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
