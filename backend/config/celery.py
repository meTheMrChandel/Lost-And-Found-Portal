"""Celery application configuration."""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("lostandfound")

# Read config from Django settings, namespace=CELERY
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Sanity-check task — run with: celery call config.celery.debug_task"""
    print(f"Request: {self.request!r}")
