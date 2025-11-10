from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from backend import views
from backend.auth_api import CurrentUserView, LogoutView, SignupView


def health(request):
    return JsonResponse({"status": "ok"})


def home(request):
    return JsonResponse({"message": "CS308 e-shopping backend is running", "ok": True})


urlpatterns = [
    path("", home),          # root icin basit yanit
    path("health/", health),
    path("admin/", admin.site.urls),

    # --- API endpoints ---
    path("api/", include("catalog.urls")),  # katalog
    path("api/search/", views.search_view, name="search"),
    path("api/home/", views.homepage_view, name="home-feed"),

    # --- Auth (DRF + SimpleJWT) ---
    path("api/auth/signup/", SignupView.as_view(), name="auth-signup"),
    path("api/auth/me/", CurrentUserView.as_view(), name="auth-me"),
    path("api/auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path(
        "api/auth/token/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path("api/auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
]
