from django.urls import path
from .views import MeProfileView

urlpatterns = [
    # GET  /api/users/me/profile/  → kendi profilini getir
    # PUT  /api/users/me/profile/  → kendi profilini güncelle
    path("me/profile/", MeProfileView.as_view(), name="me-profile"),
]