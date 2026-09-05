from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("refresh/", views.RefreshView.as_view(), name="refresh"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("me/", views.MeView.as_view(), name="me"),
    path("password/change/", views.ChangePasswordView.as_view(), name="password-change"),
    path(
        "verify-email/request/", views.EmailVerificationRequestView.as_view(), name="verify-request"
    ),
    path(
        "verify-email/confirm/", views.EmailVerificationConfirmView.as_view(), name="verify-confirm"
    ),
    path("password-reset/request/", views.PasswordResetRequestView.as_view(), name="reset-request"),
    path("password-reset/confirm/", views.PasswordResetConfirmView.as_view(), name="reset-confirm"),
]
