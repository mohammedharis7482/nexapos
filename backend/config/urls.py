"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from common.views import HealthView, ReadinessView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", HealthView.as_view(), name="health"),
    path("api/v1/readiness/", ReadinessView.as_view(), name="readiness"),
    path("api/v1/auth/", include("apps.accounts.api.urls")),
    path("api/v1/auth/", include("apps.saas.api.auth_urls")),
    path("api/v1/saas/", include("apps.saas.api.urls")),
    path("api/v1/", include("apps.saas.api.tenant_urls")),
    path("api/v1/shop/", include("apps.shops.api.urls")),
    path("api/v1/", include("apps.products.api.urls")),
    path("api/v1/inventory/", include("apps.inventory.api.urls")),
    path("api/v1/billing/", include("apps.sales.api.urls")),
    path("api/v1/sales/", include("apps.sales.api.sales_urls")),
    path("api/v1/dashboard/", include("apps.reports.api.urls")),
    path("api/v1/reports/", include("apps.reports.api.report_urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]
