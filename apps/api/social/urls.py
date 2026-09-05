from django.urls import path

from . import views

app_name = "social"

urlpatterns = [
    path("users/<str:username>/", views.ProfileView.as_view(), name="profile"),
    path("users/<str:username>/follow/", views.FollowView.as_view(), name="follow"),
    path(
        "users/<str:username>/<str:direction>/",
        views.FollowListView.as_view(),
        name="follow-list",
    ),
    path("me/showcase/", views.ShowcaseView.as_view(), name="showcase"),
    path("sets/<slug:slug>/like/", views.LikeSetView.as_view(), name="like-set"),
    path("sets/<slug:slug>/comments/", views.SetCommentsView.as_view(), name="comments"),
    path("comments/<uuid:comment_id>/", views.CommentView.as_view(), name="comment"),
    path("cards/<uuid:card_id>/like/", views.LikeCardView.as_view(), name="like-card"),
    path("reports/", views.ReportView.as_view(), name="report"),
    path("search/", views.SearchView.as_view(), name="search"),
]
