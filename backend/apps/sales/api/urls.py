from django.urls import path

from .views import (
    DraftCancelView,
    DraftCompleteView,
    DraftDetailView,
    DraftItemCreateView,
    DraftItemDetailView,
    DraftListCreateView,
)

app_name = "sales_api"

urlpatterns = [
    path("drafts/", DraftListCreateView.as_view(), name="draft-list"),
    path("drafts/<uuid:sale_id>/", DraftDetailView.as_view(), name="draft-detail"),
    path(
        "drafts/<uuid:sale_id>/items/",
        DraftItemCreateView.as_view(),
        name="draft-item-create",
    ),
    path(
        "drafts/<uuid:sale_id>/items/<uuid:item_id>/",
        DraftItemDetailView.as_view(),
        name="draft-item-detail",
    ),
    path(
        "drafts/<uuid:sale_id>/cancel/",
        DraftCancelView.as_view(),
        name="draft-cancel",
    ),
    path(
        "drafts/<uuid:sale_id>/complete/",
        DraftCompleteView.as_view(),
        name="draft-complete",
    ),
]
