from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import UserProfile

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]
        # password is not exposed via API (stored hashed in DB)


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for UserProfile supporting multiple roles.
    
    Sensitive fields (tax_id, home_address, card_number) are automatically
    encrypted when stored and decrypted when retrieved via model properties.
    """
    user = UserSerializer(read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    
    # Use SerializerMethodField for reading encrypted fields (calls property getters)
    tax_id = serializers.SerializerMethodField()
    home_address = serializers.SerializerMethodField()
    card_number = serializers.SerializerMethodField()
    
    # Write-only fields for updating encrypted data
    tax_id_input = serializers.CharField(
        write_only=True, required=False, allow_blank=True, source='tax_id'
    )
    home_address_input = serializers.CharField(
        write_only=True, required=False, allow_blank=True, source='home_address'
    )
    card_number_input = serializers.CharField(
        write_only=True, required=False, allow_blank=True, source='card_number'
    )

    class Meta:
        model = UserProfile
        fields = [
            "user",
            "role",
            "role_display",
            "tax_id",
            "home_address",
            "card_number",
            "tax_id_input",
            "home_address_input",
            "card_number_input",
        ]
        read_only_fields = ["role"]  # Role should be changed via admin or specific endpoint
    
    def get_tax_id(self, obj) -> str:
        """Get decrypted tax_id via model property."""
        return obj.tax_id
    
    def get_home_address(self, obj) -> str:
        """Get decrypted home_address via model property."""
        return obj.home_address
    
    def get_card_number(self, obj) -> str:
        """
        Get masked card number for security.
        Only returns last 4 digits if card number exists.
        """
        card = obj.card_number
        if card and len(card) >= 4:
            return f"****{card[-4:]}"
        return ""
    
    def update(self, instance, validated_data):
        """Update profile with encrypted sensitive fields."""
        # Handle encrypted fields via properties (which auto-encrypt)
        if 'tax_id' in validated_data:
            instance.tax_id = validated_data.pop('tax_id')
        if 'home_address' in validated_data:
            instance.home_address = validated_data.pop('home_address')
        if 'card_number' in validated_data:
            instance.card_number = validated_data.pop('card_number')
        
        # Handle any remaining fields normally
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance
