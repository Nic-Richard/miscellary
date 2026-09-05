from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from . import storage
from .models import Image
from .serializers import CompleteUploadSerializer, CreateUploadSerializer, ImageSerializer


class CreateUploadView(APIView):
    """Reserve a key and hand the client a presigned PUT URL."""

    throttle_scope = "uploads"

    def post(self, request: Request) -> Response:
        serializer = CreateUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        kind = serializer.validated_data["kind"]
        content_type = serializer.validated_data["content_type"]

        image = Image.objects.create(
            owner=request.user,  # type: ignore[misc]
            kind=kind,
            key=storage.new_key(kind, content_type),
            content_type=content_type,
        )
        return Response(
            {
                "image": ImageSerializer(image).data,
                "upload_url": storage.presigned_put_url(image.key, content_type),
                "max_size": storage.MAX_SIZE,
            },
            status=status.HTTP_201_CREATED,
        )


class CompleteUploadView(APIView):
    """Called after the PUT succeeds. Verifies the object exists and records dimensions."""

    def post(self, request: Request, image_id) -> Response:
        image = get_object_or_404(Image, id=image_id, owner=request.user)
        serializer = CompleteUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        size = storage.object_size(image.key)
        if size is None:
            raise ValidationError("The upload didn't finish. Try again.")
        if size > storage.MAX_SIZE:
            storage.delete_object(image.key)
            image.delete()
            raise ValidationError("That image is too large (10 MB max).")

        image.size = size
        image.width = serializer.validated_data["width"]
        image.height = serializer.validated_data["height"]
        image.ready = True
        image.save(update_fields=["size", "width", "height", "ready"])
        return Response(ImageSerializer(image).data)
