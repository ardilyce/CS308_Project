import pytest
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from backend.auth_api import CurrentUserView, LogoutView, SignupView

pytestmark = pytest.mark.django_db


def _factory():
    return APIRequestFactory()


def test_signup_view_creates_user_and_returns_tokens():
    factory = _factory()
    payload = {
        "name": "  Alice Example  ",
        "email": "Alice@example.com",
        "password": "hunter22",
    }

    request = factory.post("/api/auth/signup/", payload, format="json")
    response = SignupView.as_view()(request)

    assert response.status_code == status.HTTP_201_CREATED
    body = response.data
    assert body["ok"] is True
    assert body["user"]["email"] == "alice@example.com"
    assert body["user"]["name"] == "Alice Example"
    assert "access" in body["tokens"]
    assert "refresh" in body["tokens"]

    created = User.objects.get(email="alice@example.com")
    assert created.first_name == "Alice Example"
    assert created.username == "alice@example.com"
    assert created.check_password("hunter22")


def test_signup_view_creates_customer_profile_with_all_properties():
    """Test that signup creates a customer with all required properties:
    ID, name, taxID, e-mail address, home address, and password"""
    factory = _factory()
    payload = {
        "name": "John Doe",
        "email": "john.doe@example.com",
        "password": "secure123",
        "home_address": "123 Main St, Istanbul, Turkey",
        "tax_id": "12345678901",
    }

    request = factory.post("/api/auth/signup/", payload, format="json")
    response = SignupView.as_view()(request)

    assert response.status_code == status.HTTP_201_CREATED
    body = response.data
    assert body["ok"] is True

    # Verify User model properties
    created_user = User.objects.get(email="john.doe@example.com")
    assert created_user.id is not None  # ID
    assert created_user.first_name == "John Doe"  # name
    assert created_user.email == "john.doe@example.com"  # e-mail address
    assert created_user.check_password("secure123")  # password (hashed)

    # Verify UserProfile properties (customer role by default)
    profile = created_user.profile
    assert profile.tax_id == "12345678901"  # taxID
    assert profile.home_address == "123 Main St, Istanbul, Turkey"  # home address


def test_signup_view_rejects_duplicate_email():
    factory = _factory()
    email = "duplicate@example.com"
    User.objects.create_user(username=email, email=email, password="original!")

    request = factory.post(
        "/api/auth/signup/",
        {"name": "Alice", "email": email, "password": "hunter22"},
        format="json",
    )
    response = SignupView.as_view()(request)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data == {"email": ["Email already registered"]}


def test_token_obtain_pair_view_returns_tokens_for_valid_user():
    factory = _factory()
    email = "user@example.com"
    password = "correct!"
    User.objects.create_user(username=email, email=email, password=password)

    request = factory.post(
        "/api/auth/token/",
        {"username": email, "password": password},
        format="json",
    )
    response = TokenObtainPairView.as_view()(request)

    assert response.status_code == status.HTTP_200_OK
    assert "access" in response.data
    assert "refresh" in response.data


def test_token_obtain_pair_view_rejects_invalid_credentials():
    factory = _factory()
    email = "user@example.com"
    password = "correct!"
    User.objects.create_user(username=email, email=email, password=password)

    request = factory.post(
        "/api/auth/token/",
        {"username": email, "password": "nope"},
        format="json",
    )
    response = TokenObtainPairView.as_view()(request)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "No active account" in response.data["detail"]


def test_current_user_view_requires_authentication():
    factory = _factory()

    request = factory.get("/api/auth/me/")
    response = CurrentUserView.as_view()(request)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_current_user_view_returns_serialized_user_when_authenticated():
    factory = _factory()
    user = User.objects.create_user(
        username="user@example.com", email="user@example.com", password="secret123"
    )
    user.first_name = "Alice Example"
    user.save(update_fields=["first_name"])

    request = factory.get("/api/auth/me/")
    force_authenticate(request, user=user)
    response = CurrentUserView.as_view()(request)

    assert response.status_code == status.HTTP_200_OK
    assert response.data == {
        "id": user.id,
        "email": "user@example.com",
        "name": "Alice Example",
        "is_staff": user.is_staff,
        "role": "customer",  # Default role for new users
    }


def test_logout_view_requires_refresh_token():
    factory = _factory()
    user = User.objects.create_user(
        username="user@example.com", email="user@example.com", password="secret123"
    )

    request = factory.post("/api/auth/logout/", {}, format="json")
    force_authenticate(request, user=user)
    response = LogoutView.as_view()(request)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data == {"ok": False, "error": "Refresh token is required"}


def test_logout_view_blacklists_refresh_token():
    factory = _factory()
    user = User.objects.create_user(
        username="user@example.com", email="user@example.com", password="secret123"
    )
    refresh = RefreshToken.for_user(user)

    request = factory.post(
        "/api/auth/logout/",
        {"refresh": str(refresh)},
        format="json",
    )
    force_authenticate(request, user=user)
    response = LogoutView.as_view()(request)

    assert response.status_code == status.HTTP_205_RESET_CONTENT
    assert response.data == {"ok": True}
    assert BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists()
