from rest_framework import exceptions, permissions


class EmailNotVerified(exceptions.PermissionDenied):
    default_detail = "Verify your email address first."
    error_code = "email_unverified"


class EmailVerified(permissions.IsAuthenticated):
    """Trading and publishing reach other collectors, so they wait on a confirmed address."""

    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False
        if request.method in permissions.SAFE_METHODS or request.user.email_verified:
            return True
        raise EmailNotVerified()
