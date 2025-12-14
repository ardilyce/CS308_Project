from rest_framework import generics, permissions
from .models import CustomerProfile
from .serializers import CustomerProfileSerializer


class MeProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CustomerProfileSerializer

    def get_object(self):
        obj, created = CustomerProfile.objects.get_or_create(user=self.request.user)
        return obj
