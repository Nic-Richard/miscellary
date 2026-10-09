from datetime import UTC, datetime

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from accounts.models import User
from billing.actions import grant_bundle, grant_subscription_period, set_auto_renewal
from cards.models import CardSet
from lounge.models import Attachment, Post, Reply
from packs.actions import open_free_pack
from packs.models import OwnedCard, SetPoints
from social.models import SetFollow

PASSWORD = "preview-only-password"


class Command(BaseCommand):
    help = "Prepare labelled local preview accounts without payments or resetting existing data."

    @transaction.atomic
    def handle(self, *args, **options):
        database = settings.DATABASES["default"]
        if (
            not settings.DEBUG
            or not settings.MONETIZATION_PREVIEW
            or not settings.MONETIZATION_ENABLED
            or not settings.LOUNGE_ENABLED
            or database.get("HOST") not in {"db", "localhost", "127.0.0.1"}
            or database.get("NAME") != "miscellary"
            or settings.STRIPE_CHECKOUT_ENABLED
        ):
            raise CommandError("Only run against the local Docker preview with checkout disabled.")
        users = {}
        for name in ("previewfree", "previewsupporter", "previewcancelled"):
            email = f"{name}@preview.invalid"
            existing = User.objects.filter(Q(username=name) | Q(email=email)).first()
            if existing and (
                existing.username != name or existing.email != email or not existing.is_active
            ):
                raise CommandError(f"{name} is not an available preview account.")
            user = existing or User.objects.create_user(email, name, PASSWORD, email_verified=True)
            users[name] = user
            grant_bundle(user, "web", f"preview:bundle:{user.pk}", "credits_125")
        now = timezone.now().astimezone(UTC)
        start = datetime(now.year, now.month, 1, tzinfo=UTC)
        end = datetime(now.year + (now.month == 12), now.month % 12 + 1, 1, tzinfo=UTC)
        for name in ("previewsupporter", "previewcancelled"):
            user = users[name]
            reference = f"preview:subscription:{user.pk}"
            grant_subscription_period(
                user, "web", f"{reference}:{start:%Y-%m}", reference, start, end
            )
            set_auto_renewal(user, "web", reference, name == "previewsupporter")
        sets = list(CardSet.objects.filter(status=CardSet.Status.PUBLISHED).order_by("slug")[:3])
        if not sets:
            raise CommandError(
                "Prepare the normal local catalogue first; no preview content was created."
            )
        for user in users.values():
            for card_set in sets:
                SetFollow.objects.get_or_create(user=user, card_set=card_set)
                if not OwnedCard.objects.filter(owner=user, card__card_set=card_set).exists():
                    open_free_pack(user, card_set)
                SetPoints.objects.get_or_create(
                    user=user, card_set=card_set, defaults={"balance": 20}
                )
        for name, title, style in (
            ("previewfree", "What's your favourite card?", "plain"),
            ("previewsupporter", "A few cards from my collection", "binder"),
            ("previewcancelled", "A few favourites", "plain"),
        ):
            user = users[name]
            post, created = Post.objects.get_or_create(
                author=user,
                title=title,
                defaults={
                    "body": "Local preview discussion. Try replies, likes and collection layouts.",
                    "style": style,
                },
            )
            if created:
                count = 1 if name == "previewfree" else 3
                cards = OwnedCard.objects.filter(owner=user).order_by("pk")[:count]
                Attachment.objects.bulk_create(
                    [
                        Attachment(post=post, owned_card=card, position=index)
                        for index, card in enumerate(cards)
                    ]
                )
                root = Reply.objects.create(
                    post=post,
                    author=users["previewfree"],
                    body="Which card would you put on display?",
                )
                Reply.objects.create(
                    post=post,
                    parent=root,
                    author=users["previewsupporter"],
                    body="The one with the best story behind it.",
                )
        self.stdout.write(
            "Local preview ready. Free: previewfree; "
            "active: previewsupporter; cancelled: previewcancelled."
        )
        self.stdout.write(f"Each email is <username>@preview.invalid. Password: {PASSWORD}")
