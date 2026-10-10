from django.urls import path

from . import views

app_name = "lounge"
urlpatterns = [
    path("lounge/", views.LoungeView.as_view(), name="feed"),
    path("lounge/posts/<uuid:post_id>/", views.PostView.as_view(), name="post"),
    path("lounge/posts/<uuid:post_id>/replies/", views.RepliesView.as_view(), name="replies"),
    path("lounge/posts/<uuid:post_id>/vote/", views.VoteView.as_view(), name="vote-post"),
    path("lounge/replies/<uuid:reply_id>/", views.ReplyView.as_view(), name="reply"),
    path("lounge/replies/<uuid:reply_id>/vote/", views.VoteView.as_view(), name="vote-reply"),
    path("lounge/posts/<uuid:post_id>/save/", views.SaveView.as_view(), name="save"),
    path("me/lounge/drafts/", views.DraftsView.as_view(), name="drafts"),
    path("me/lounge/folders/", views.FoldersView.as_view(), name="folders"),
    path("me/lounge/folders/<int:folder_id>/", views.FolderView.as_view(), name="folder"),
]
