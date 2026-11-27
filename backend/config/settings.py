import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.getenv("DJANGO_DEBUG") == "1"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY") or (
    "local-development-only" if DEBUG else ""
)
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
WEB_ORIGIN = os.getenv("WEB_ORIGIN", "http://localhost:3000").rstrip("/")
CSRF_TRUSTED_ORIGINS = [WEB_ORIGIN]
SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = not DEBUG
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "rest_framework",
    "game",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
]
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.getenv("DATABASE_PATH", BASE_DIR / "db.sqlite3"),
        "OPTIONS": {"transaction_mode": "IMMEDIATE", "timeout": 20},
    }
}
USE_TZ = True
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend"
    if DEBUG
    else "django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = os.getenv("SMTP_HOST", "localhost")
EMAIL_PORT = int(os.getenv("SMTP_PORT", "587"))
EMAIL_HOST_USER = os.getenv("SMTP_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("SMTP_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("SMTP_TLS", "1") == "1"
EMAIL_TIMEOUT = 6
DEFAULT_FROM_EMAIL = os.getenv("FROM_EMAIL", "guesswar@localhost")
CSRF_FAILURE_VIEW = "game.views.csrf_failure"
