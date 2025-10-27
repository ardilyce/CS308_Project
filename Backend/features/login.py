import jwt
import os
from datetime import datetime, timedelta, timezone
from django.contrib.auth.models import User
from django.contrib.auth.hashers import check_password
from django.http import JsonResponse
from django.conf import settings

def login(data):
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return JsonResponse({"ok": False, "error": "Email and password required"}, status=400)

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return JsonResponse({"ok": False, "error": "User not found"}, status=404)

    if not check_password(password, user.password):
        return JsonResponse({"ok": False, "error": "Wrong password"}, status=401)
    
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": user.id,
        "email": user.email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=12)).timestamp()),
    }

    secret = os.getenv("SECRET_KEY", settings.SECRET_KEY)
    token = jwt.encode(payload, secret, algorithm="HS256")

    return JsonResponse({
        "ok": True,
        "token": token,
        "user": {"id": user.id, "email": user.email}
    })