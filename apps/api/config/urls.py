from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from common.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", health, name="health"),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/uploads/", include("uploads.urls")),
    path("api/v1/", include("cards.urls")),
    path("api/v1/", include("packs.urls")),
    path("api/v1/", include("trades.urls")),
    path("api/v1/", include("social.urls")),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
