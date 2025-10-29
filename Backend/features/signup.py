import re
from django.contrib.auth.models import User
from django.http import JsonResponse


def _is_valid_email(email: str):
    # Simple email sanity check; Django has better validators but keep it lightweight here
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email or ""))


def signup(data):
    """
    Create a new user account.

    Expected data keys:
      - name (required)
      - email (required, unique)
      - password (required, min 6 chars)
      - address (optional, currently ignored)
      - taxId (optional, currently ignored)

    Returns JSON { ok: True, user: {id, email, name} } on success (201),
    or { ok: False, error: "..." } on failure with appropriate status.
    """

    name = (data or {}).get("name", "").strip()
    email = (data or {}).get("email", "").strip().lower()
    password = (data or {}).get("password", "")

    if not name:
        return JsonResponse({"ok": False, "error": "Name is required"}, status=400)
    if not email:
        return JsonResponse({"ok": False, "error": "Email is required"}, status=400)
    if not _is_valid_email(email):
        return JsonResponse({"ok": False, "error": "Invalid email"}, status=400)
    if not password:
        return JsonResponse({"ok": False, "error": "Password is required"}, status=400)
    if len(password) < 6:
        return JsonResponse({"ok": False, "error": "Password must be at least 6 characters"}, status=400)

    # Enforce uniqueness on email
    if User.objects.filter(email=email).exists():
        return JsonResponse({"ok": False, "error": "Email already registered"}, status=409)

    # Use email as username to satisfy default User model requirement
    username = email
    if User.objects.filter(username=username).exists():
        return JsonResponse({"ok": False, "error": "Account already exists"}, status=409)

    user = User(username=username, email=email, first_name=name)
    user.set_password(password)
    user.save()

    # Note: address and taxId are accepted but not stored yet (no profile model)

    return JsonResponse(
        {
            "ok": True,
            "user": {"id": user.id, "email": user.email, "name": user.first_name},
        },
        status=201,
    )

