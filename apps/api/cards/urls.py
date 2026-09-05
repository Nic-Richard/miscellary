from django.urls import path

from . import views

app_name = "cards"

urlpatterns = [
    path("templates/", views.TemplateListView.as_view(), name="templates"),
    path("sets/", views.PublicSetListView.as_view(), name="public-sets"),
    path("sets/<slug:slug>/", views.PublicSetDetailView.as_view(), name="public-set"),
    path("me/sets/", views.MySetListView.as_view(), name="my-sets"),
    path("me/sets/<uuid:set_id>/", views.MySetDetailView.as_view(), name="my-set"),
    path("me/sets/<uuid:set_id>/publish/", views.PublishSetView.as_view(), name="publish"),
    path("me/sets/<uuid:set_id>/cards/", views.MyCardListView.as_view(), name="my-cards"),
    path(
        "me/sets/<uuid:set_id>/cards/<uuid:card_id>/",
        views.MyCardDetailView.as_view(),
        name="my-card",
    ),
]
