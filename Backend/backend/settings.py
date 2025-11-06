# Backend/backend/settings.py
import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

# -------------------------------------------------------------------
# Base
# -------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent  # Backend/backend
PROJECT_ROOT = BASE_DIR.parent                     # Backend/

# .env'i proje kökünden yükle (Backend/.env)
load_dotenv(dotenv_path=PROJECT_ROOT / ".env")

def get_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(int(default))) in {"1", "true", "True", "YES", "yes"}

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
DEBUG = get_bool("DEBUG", False)

# "127.0.0.1,localhost" -> ["127.0.0.1","localhost"]
ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "127.0.0.1,localhost").split(",") if h.strip()]
if DEBUG and "*" not in ALLOWED_HOSTS:
    # Geliştirmede kolaylık için wildcard ekleyebiliriz (opsiyonel)
    ALLOWED_HOSTS.append("*")

# -------------------------------------------------------------------
# Apps
# -------------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "corsheaders",
    "rest_framework",

    "catalog",
]

REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# -------------------------------------------------------------------
# Middleware
#  - CORS middleware'i en üste yakın olmalı
# -------------------------------------------------------------------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",

    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# -------------------------------------------------------------------
# URLs / WSGI
# -------------------------------------------------------------------
ROOT_URLCONF = "backend.urls"
WSGI_APPLICATION = "backend.wsgi.application"

# -------------------------------------------------------------------
# Templates (admin için gerekli)
# -------------------------------------------------------------------
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
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

# -------------------------------------------------------------------
# Static & Media
# -------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = PROJECT_ROOT / "staticfiles"   # deploy/CI için güvenli
MEDIA_URL = "media/"
MEDIA_ROOT = PROJECT_ROOT / "media"

# -------------------------------------------------------------------
# Database (Neon + güvenli fallback)
#  - CI'da .env/secret yoksa SQLite'a düşer, crash olmaz
#  - Neon için ssl_require=True
# -------------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            ssl_require=True,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": PROJECT_ROOT / "db.sqlite3",
        }
    }

# -------------------------------------------------------------------
# CORS / CSRF
# -------------------------------------------------------------------
# DEBUG'da tüm origin'leri aç; prod'da ENV'den oku
CORS_ALLOW_ALL_ORIGINS = DEBUG or get_bool("CORS_ALLOW_ALL_ORIGINS", False)

# Belirli origin'ler için (örn: React):
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173"
    ).split(",") if o.strip()
]


CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()
]

# -------------------------------------------------------------------
# i18n / tz
# -------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Europe/Istanbul"
USE_I18N = True
USE_TZ = True

# -------------------------------------------------------------------
# Django 4+ default PK type
# -------------------------------------------------------------------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

