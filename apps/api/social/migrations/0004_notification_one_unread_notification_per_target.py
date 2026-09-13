from django.conf import settings
from django.db import migrations, models
from django.db.models import Count


def drop_duplicate_unread(apps, schema_editor):
    """Existing rows predate the constraint, so clear what it would reject.

    The rule has been advisory until now, so a database can already hold two
    unread notifications for one actor, kind and target. Keep the newest of each
    group, which is the one the recipient would have been shown anyway.
    """
    Notification = apps.get_model("social", "Notification")
    fields = ["recipient", "actor", "kind", "card_set", "card", "comment"]
    groups = (
        Notification.objects.filter(read_at__isnull=True)
        .values(*fields)
        .annotate(n=Count("id"))
        .filter(n__gt=1)
    )
    for group in groups:
        group.pop("n")
        keep = (
            Notification.objects.filter(read_at__isnull=True, **group)
            .order_by("-created_at")
            .values_list("id", flat=True)
            .first()
        )
        Notification.objects.filter(read_at__isnull=True, **group).exclude(id=keep).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("cards", "0022_alter_cardset_mark"),
        ("social", "0003_notification_setfollow"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(drop_duplicate_unread, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="notification",
            constraint=models.UniqueConstraint(
                condition=models.Q(("read_at__isnull", True)),
                fields=("recipient", "actor", "kind", "card_set", "card", "comment"),
                name="one_unread_notification_per_target",
                nulls_distinct=False,
            ),
        ),
    ]
