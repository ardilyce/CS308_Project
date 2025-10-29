import json

import jwt
import pytest
from django.contrib.auth.models import User

pytestmark = pytest.mark.django_db


def _parse(response):
    return json.loads(response.content.decode("utf-8"))


def test_signup_creates_user_with_cleaned_data():
    from features.signup import signup

    payload = {
        "name": "  Alice Example  ",
        "email": "Alice@example.com",
        "password": "hunter22",
    }

    response = signup(payload)
    data = _parse(response)

    assert response.status_code == 201
    assert data["ok"] is True

    created = User.objects.get(email="alice@example.com")
    assert created.first_name == "Alice Example"
    assert created.username == "alice@example.com"
    assert created.check_password("hunter22")
    assert data["user"]["id"] == created.id
    assert data["user"]["email"] == created.email
    assert data["user"]["name"] == created.first_name


@pytest.mark.parametrize(
    "payload, error",
    [
        ({"email": "user@example.com", "password": "hunter22"}, "Name is required"),
        ({"name": "Alice", "password": "hunter22"}, "Email is required"),
        ({"name": "Alice", "email": "user@example.com"}, "Password is required"),
        (
            {"name": "Alice", "email": "not-an-email", "password": "hunter22"},
            "Invalid email",
        ),
        (
            {"name": "Alice", "email": "user@example.com", "password": "123"},
            "Password must be at least 6 characters",
        ),
    ],
)
def test_signup_validation_errors(payload, error):
    from features.signup import signup

    response = signup(payload)
    data = _parse(response)

    assert response.status_code == 400
    assert data == {"ok": False, "error": error}


def test_signup_rejects_duplicate_email():
    from features.signup import signup

    email = "duplicate@example.com"
    User.objects.create_user(username=email, email=email, password="original!")

    response = signup({"name": "Alice", "email": email, "password": "another!"})
    data = _parse(response)

    assert response.status_code == 409
    assert data == {"ok": False, "error": "Email already registered"}


def test_signup_rejects_duplicate_username_when_email_differs():
    from features.signup import signup

    email = "unique@example.com"
    User.objects.create(username=email, email="other@example.com")

    response = signup({"name": "Bob", "email": email, "password": "another!"})
    data = _parse(response)

    assert response.status_code == 409
    assert data == {"ok": False, "error": "Account already exists"}


def test_login_requires_email_and_password():
    from features.login import login

    response = login({"email": "", "password": ""})
    data = _parse(response)

    assert response.status_code == 400
    assert data == {"ok": False, "error": "Email and password required"}


def test_login_rejects_unknown_user():
    from features.login import login

    response = login({"email": "nobody@example.com", "password": "hunter22"})
    data = _parse(response)

    assert response.status_code == 404
    assert data == {"ok": False, "error": "User not found"}


def test_login_rejects_wrong_password():
    from features.login import login

    email = "user@example.com"
    User.objects.create_user(username=email, email=email, password="correct!")

    response = login({"email": email, "password": "incorrect"})
    data = _parse(response)

    assert response.status_code == 401
    assert data == {"ok": False, "error": "Wrong password"}


def test_login_success_returns_jwt_with_expected_claims(monkeypatch):
    from features.login import login

    email = "user@example.com"
    password = "correct!"
    user = User.objects.create_user(username=email, email=email, password=password)

    monkeypatch.setenv("SECRET_KEY", "test-secret")

    response = login({"email": email, "password": password})
    data = _parse(response)

    assert response.status_code == 200
    assert data["ok"] is True
    assert data["user"] == {"id": user.id, "email": email}

    token = data["token"]
    assert isinstance(token, str)

    decoded = jwt.decode(token, "test-secret", algorithms=["HS256"])
    assert decoded["user_id"] == user.id
    assert decoded["email"] == email
    assert decoded["exp"] - decoded["iat"] == 12 * 60 * 60
