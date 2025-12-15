from rest_framework import generics, permissions
from .models import UserProfile
from .serializers import UserProfileSerializer


class MeProfileView(generics.RetrieveUpdateAPIView):
    """
    API endpoint that allows authenticated users to retrieve or update their profile.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        obj, created = UserProfile.objects.get_or_create(user=self.request.user)
        return obj
