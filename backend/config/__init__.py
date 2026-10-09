"""config/__init__.py — make Celery app available as part of the package."""

from .celery import app as celery_app

__all__ = ("celery_app",)
