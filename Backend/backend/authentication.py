# Backend/backend/authentication.py
"""
Custom authentication that silently ignores invalid tokens for public endpoints.
This prevents 401 errors when users have stale tokens in localStorage.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class LenientJWTAuthentication(JWTAuthentication):
    """
    JWT Authentication that returns None instead of raising exceptions
    for invalid tokens. This allows public endpoints (AllowAny) to work
    even when the client sends an expired/invalid token.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, TokenError):
            # Invalid token → treat as anonymous user instead of raising 401
            return None

