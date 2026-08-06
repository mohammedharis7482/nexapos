from drf_spectacular.utils import extend_schema
from rest_framework.permissions import SAFE_METHODS
from rest_framework.views import APIView

from apps.saas.models import AuditEvent
from common.permissions import IsCashierOrOwner, IsOwner
from common.views import success_response

from .serializers import ShopSettingsSerializer


class ShopSettingsView(APIView):
    def get_permissions(self):
        permission_classes = (
            [IsCashierOrOwner] if self.request.method in SAFE_METHODS else [IsOwner]
        )
        return [permission() for permission in permission_classes]

    @extend_schema(responses={200: ShopSettingsSerializer})
    def get(self, request):
        serializer = ShopSettingsSerializer(request.user.shop)
        return success_response("Shop settings retrieved.", serializer.data)

    @extend_schema(
        request=ShopSettingsSerializer,
        responses={200: ShopSettingsSerializer},
    )
    def patch(self, request):
        shop = request.user.shop
        serializer = ShopSettingsSerializer(
            shop,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        AuditEvent.objects.create(
            shop=shop,
            actor=request.user,
            event=AuditEvent.Event.SHOP_SETTINGS_UPDATED,
        )
        return success_response("Shop settings updated.", serializer.data)
