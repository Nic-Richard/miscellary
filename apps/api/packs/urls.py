from django.urls import path

from . import views

app_name = "packs"

urlpatterns = [
    path("sets/<slug:slug>/packs/", views.PackStatusView.as_view(), name="status"),
    path("sets/<slug:slug>/packs/open/", views.OpenPackView.as_view(), name="open"),
    path("me/cards/", views.MyCollectionView.as_view(), name="collection"),
    path("me/cards/<uuid:card_id>/recycle/", views.RecycleCardView.as_view(), name="recycle"),
    path("me/points/", views.MyPointsView.as_view(), name="points"),
    path("users/<str:username>/cards/", views.UserCollectionView.as_view(), name="user-collection"),
]
