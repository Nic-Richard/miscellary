from django.urls import path

from . import views

app_name = "uploads"

urlpatterns = [
    path("", views.CreateUploadView.as_view(), name="create"),
    path("<uuid:image_id>/complete/", views.CompleteUploadView.as_view(), name="complete"),
]
