from django.urls import path

from .views import (
    OnboardingCompleteView,
    OnboardingView,
    PlanListView,
    RegisterView,
    SubscriptionView,
)

app_name = "saas_api"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("onboarding/", OnboardingView.as_view(), name="onboarding"),
    path("onboarding/complete/", OnboardingCompleteView.as_view(), name="onboarding-complete"),
    path("subscription/", SubscriptionView.as_view(), name="subscription"),
    path("plans/", PlanListView.as_view(), name="plans"),
]
