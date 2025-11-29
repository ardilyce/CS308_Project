from rest_framework import generics, permissions
from .models import CustomerProfile
from .serializers import CustomerProfileSerializer


class MeProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CustomerProfileSerializer

    def get_object(self):
        return CustomerProfile.objects.get(user=self.request.user)
