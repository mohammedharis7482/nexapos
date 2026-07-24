from django.urls import path

from .views import ShopSettingsView

app_name = "shops_api"

urlpatterns = [
    path("settings/", ShopSettingsView.as_view(), name="settings"),
]
