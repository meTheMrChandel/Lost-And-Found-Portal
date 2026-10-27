"""
Django settings for the Lost & Found Portal.

Environment variables are loaded from .env (see .env.example).
"""

import os
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

# ─── Core ─────────────────────────────────────────────────────────────────────
SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="*", cast=Csv())
if "testserver" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append("testserver")

# ─── Application Definition ───────────────────────────────────────────────────
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "django_filters",
    "axes",
    "django_celery_beat",
    "django_celery_results",
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.posts",
    "apps.matching",
    "apps.items",
    "apps.chat",
    "apps.notifications",
    "apps.adminpanel",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ─── Middleware ───────────────────────────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "axes.middleware.AxesMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ─── Database ─────────────────────────────────────────────────────────────────
_db_engine = config("DATABASE_ENGINE", default="django.db.backends.sqlite3")
_db_port = config("DATABASE_PORT", default="")
_db_base = {
    "ENGINE": _db_engine,
    "NAME": config("DATABASE_NAME", default=BASE_DIR / "db.sqlite3"),
    "OPTIONS": {"connect_timeout": 10} if "postgresql" in _db_engine or "mysql" in _db_engine else {},
}
if _db_port:
    _db_base["PORT"] = _db_port
if "sqlite" not in _db_engine:
    _db_base["USER"] = config("DATABASE_USER", default="postgres")
    _db_base["PASSWORD"] = config("DATABASE_PASSWORD", default="")
    _db_base["HOST"] = config("DATABASE_HOST", default="localhost")

DATABASES = {"default": _db_base}

# ─── Custom User Model ────────────────────────────────────────────────────────
AUTH_USER_MODEL = "accounts.User"

# ─── Password Validation ──────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ─── Internationalisation ─────────────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

# ─── Static / Media ──────────────────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─── REST Framework ───────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "config.exception_handler.custom_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "1000/day",
        "user": "10000/day",
        "otp_request": "5/minute",
        "login": "10/minute",
        "post_create": "20/hour",
        "chat_message": "60/minute",
    },
}

# ─── Cache & Throttling Backend ───────────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "lost-and-found-cache",
    }
}

# ─── SimpleJWT ────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("ACCESS_TOKEN_LIFETIME_MINUTES", default=15, cast=int)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("REFRESH_TOKEN_LIFETIME_DAYS", default=7, cast=int)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ─── CORS ─────────────────────────────────────────────────────────────────────
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS = config(
        "CORS_ALLOWED_ORIGINS",
        default="http://localhost:3000,http://127.0.0.1:3000,http://localhost:8081,http://127.0.0.1:8081",
        cast=Csv(),
    )
CORS_ALLOW_CREDENTIALS = True

# ─── DRF-Spectacular (OpenAPI) ────────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "Lost & Found Portal API",
    "DESCRIPTION": "REST API for the IIT Ropar Lost & Found Portal",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

# ─── Security Headers & Protection ───────────────────────────────────────────
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# ─── Celery ───────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default="redis://localhost:6379/1")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# ─── Channels (WebSocket) ────────────────────────────────────────────────────
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [config("REDIS_URL", default="redis://localhost:6379/0")],
        },
    },
}

# ─── Email ────────────────────────────────────────────────────────────────────
EMAIL_BACKEND = config(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = config("EMAIL_HOST", default="localhost")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="noreply@iitrpr.ac.in")

# ─── OTP Settings ─────────────────────────────────────────────────────────────
OTP_EXPIRY_SECONDS = config("OTP_EXPIRY_SECONDS", default=300, cast=int)
OTP_MAX_ATTEMPTS = config("OTP_MAX_ATTEMPTS", default=3, cast=int)
OTP_RESEND_COOLDOWN_SECONDS = config("OTP_RESEND_COOLDOWN_SECONDS", default=60, cast=int)

# ─── Django-axes (brute-force protection) ────────────────────────────────────
AXES_FAILURE_LIMIT = 5
AXES_LOCK_OUT_AT_FAILURE = True
AXES_COOLOFF_TIME = timedelta(minutes=30)
AXES_RESET_ON_SUCCESS = True
AXES_BACKEND = "axes.backends.AxesStandaloneBackend"

AUTHENTICATION_BACKENDS = [
    "axes.backends.AxesStandaloneBackend",
    "django.contrib.auth.backends.ModelBackend",
]

# ─── Storage ──────────────────────────────────────────────────────────────────
STORAGE_BACKEND = config("STORAGE_BACKEND", default="local")

if STORAGE_BACKEND == "s3":
    DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
    AWS_ACCESS_KEY_ID = config("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = config("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = config("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_REGION_NAME = config("AWS_S3_REGION_NAME", default="ap-south-1")
    AWS_S3_FILE_OVERWRITE = False
elif STORAGE_BACKEND == "cloudinary":
    DEFAULT_FILE_STORAGE = "cloudinary_storage.storage.MediaCloudinaryStorage"
    CLOUDINARY_URL = config("CLOUDINARY_URL")

# ─── Application constants ────────────────────────────────────────────────────
IITRPR_EMAIL_DOMAIN = "iitrpr.ac.in"
FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:3000")

# Image upload constraints
MAX_IMAGE_SIZE_MB = 5
MAX_IMAGES_PER_POST = 5
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

# Post auto-expiry
POST_EXPIRY_DAYS = 30
