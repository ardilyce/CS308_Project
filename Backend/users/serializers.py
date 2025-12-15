from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import UserProfile

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]
        # password'ü API'de göstermiyoruz (DB'de hash'li olarak tutuluyor)


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for UserProfile supporting multiple roles"""
    user = UserSerializer(read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "user",
            "role",
            "role_display",
            "tax_id",
            "home_address",
            "card_number",
        ]
        read_only_fields = ["role"]  # Role should be changed via admin or specific endpoint
