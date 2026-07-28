from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]

    @extend_schema(
        responses={
            200: inline_serializer(
                name="HealthResponse",
                fields={
                    "status": serializers.CharField(),
                    "service": serializers.CharField(),
                },
            )
        }
    )
    def get(self, request) -> Response:
        return Response({"status": "ok", "service": "NexaPOS API"})


class ReadinessView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]

    @extend_schema(
        responses={
            200: inline_serializer(
                name="ReadinessResponse",
                fields={
                    "status": serializers.CharField(),
                    "service": serializers.CharField(),
                },
            )
        }
    )
    def get(self, request) -> Response:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except DatabaseError:
            return Response(
                {"status": "unavailable", "service": "NexaPOS API"},
                status=503,
            )
        return Response({"status": "ready", "service": "NexaPOS API"})


def success_response(
    message: str,
    data=None,
    *,
    status_code: int = 200,
) -> Response:
    return Response(
        {"success": True, "message": message, "data": data},
        status=status_code,
    )
from django.db import connection
from django.db.utils import DatabaseError
