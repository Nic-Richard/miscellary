from django.urls import path

from . import views

app_name = "trades"

urlpatterns = [
    path("me/trades/", views.OfferListView.as_view(), name="offers"),
    path("me/trades/<uuid:offer_id>/", views.OfferDetailView.as_view(), name="offer"),
    path("me/trades/<uuid:offer_id>/accept/", views.AcceptOfferView.as_view(), name="accept"),
    path("me/trades/<uuid:offer_id>/reject/", views.RejectOfferView.as_view(), name="reject"),
    path("me/trades/<uuid:offer_id>/cancel/", views.CancelOfferView.as_view(), name="cancel"),
    path("me/trades/<uuid:offer_id>/counter/", views.CounterOfferView.as_view(), name="counter"),
]
