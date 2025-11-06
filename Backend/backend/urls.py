<<<<<<< HEAD
"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path
from .views import signup_view, login_view

urlpatterns = [
    path("admin/", admin.site.urls),
    # Auth endpoints
    path("auth/signup", signup_view, name="auth-signup"),
    # (Optional) Login endpoint already implemented in views
    path("auth/login", login_view, name="auth-login"),
]
=======
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


>>>>>>> main
