from django.contrib import admin
from django.urls import path,include
from django.http import JsonResponse


def health(request):
    return JsonResponse({"status": "ok"})

def home(request):
    return JsonResponse({"message": "CS308 e-shopping backend is running", "ok": True})

urlpatterns = [
    path("", home),          # ← root için basit yanıt
    path("health/", health),
    path("admin/", admin.site.urls),
    path("api/", include("catalog.urls")), 
]


