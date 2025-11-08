from django.contrib import admin
from django.urls import path,include
from django.http import JsonResponse
from backend import views


def health(request):
    return JsonResponse({"status": "ok"})

def home(request):
    return JsonResponse({"message": "CS308 e-shopping backend is running", "ok": True})

urlpatterns = [
    path("", home),          # root için basit yanıt
    path("health/", health),
    path("admin/", admin.site.urls),

    # --- API endpoints ---
    path("api/", include("catalog.urls")),          # katalog 
    path("api/login/", views.login_view, name="login"),   # login endpoint
    path("api/signup/", views.signup_view, name="signup"), # signup endpoint
    path("api/search/", views.search_view, name="search"), # search endpoint
]


