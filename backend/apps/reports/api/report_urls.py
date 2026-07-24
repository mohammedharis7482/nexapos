from django.urls import path

from .views import ReportsView

app_name = "report_foundation"

urlpatterns = [
    path("", ReportsView.as_view(), name="reports"),
]
