from django.urls import path

from .shift_views import (
    CloseShiftView,
    CurrentShiftView,
    OpenShiftView,
    ShiftDetailView,
    ShiftListView,
)

app_name = "shift_api"

urlpatterns = [
    path("current/", CurrentShiftView.as_view(), name="current"),
    path("open/", OpenShiftView.as_view(), name="open"),
    path("<uuid:shift_id>/close/", CloseShiftView.as_view(), name="close"),
    path("<uuid:shift_id>/", ShiftDetailView.as_view(), name="detail"),
    path("", ShiftListView.as_view(), name="list"),
]
