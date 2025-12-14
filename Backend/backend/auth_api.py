from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken


User = get_user_model()


class CurrentUserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name")
    is_staff = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ("id", "email", "name", "is_staff")


class SignupSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", max_length=150)
    password = serializers.CharField(write_only=True, min_length=6)
    home_address = serializers.CharField(required=False, allow_blank=True)
    tax_id = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("id", "email", "name", "password", "home_address", "tax_id")
        read_only_fields = ("id",)

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Email already registered")
        return email

    def create(self, validated_data):
        password = validated_data.pop("password")
        home_address = validated_data.pop("home_address", "")
        tax_id = validated_data.pop("tax_id", "")
        
        email = validated_data.get("email", "").lower()
        first_name = validated_data.get("first_name", "")

        user = User(
            username=email,
            email=email,
            first_name=first_name,
        )
        user.set_password(password)
        user.save()
        
        # The profile is auto-created by signal, but we need to update it
        profile = user.profile
        profile.home_address = home_address
        profile.tax_id = tax_id
        profile.save()
        
        return user


class SignupView(generics.CreateAPIView):
    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        payload = {
            "ok": True,
            "user": CurrentUserSerializer(user).data,
            "tokens": {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
        }
        headers = self.get_success_headers(serializer.data)
        return Response(payload, status=status.HTTP_201_CREATED, headers=headers)


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = CurrentUserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class LogoutView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"ok": False, "error": "Refresh token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response(
                {"ok": False, "error": "Invalid refresh token"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({"ok": True}, status=status.HTTP_205_RESET_CONTENT)
