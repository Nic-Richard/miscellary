# The badge's overall size moves onto its layer, so it is set where every other
# layer's size is set, and its type gains a size of its own. Text layers drop
# anchor and case, which were not earning their place.

import django.core.validators
from django.db import migrations, models


def size_onto_layer(apps, schema_editor):
    """Carry emblem_scale onto the badge layer, and drop the dead text keys."""
    CardSet = apps.get_model("cards", "CardSet")
    for card_set in CardSet.objects.iterator():
        layers = card_set.pack_layers or []
        for layer in layers:
            if layer.get("kind") == "emblem":
                layer["scale"] = card_set.emblem_scale
        lines = [
            {k: v for k, v in line.items() if k not in ("align", "case")}
            for line in (card_set.pack_text or [])
        ]
        card_set.pack_layers = layers
        card_set.pack_text = lines
        card_set.save(update_fields=["pack_layers", "pack_text"])


def size_off_layer(apps, schema_editor):
    """Back out: the badge layer's size becomes emblem_scale again."""
    CardSet = apps.get_model("cards", "CardSet")
    for card_set in CardSet.objects.iterator():
        for layer in card_set.pack_layers or []:
            if layer.get("kind") == "emblem":
                card_set.emblem_scale = min(140, max(60, layer.get("scale", 100)))
                card_set.save(update_fields=["emblem_scale"])
                break


class Migration(migrations.Migration):
    dependencies = [
        ("cards", "0009_pack_layers_default"),
    ]

    operations = [
        migrations.AddField(
            model_name="cardset",
            name="emblem_type_scale",
            field=models.PositiveSmallIntegerField(
                default=100,
                validators=[
                    django.core.validators.MinValueValidator(60),
                    django.core.validators.MaxValueValidator(140),
                ],
            ),
        ),
        migrations.RunPython(size_onto_layer, size_off_layer),
        migrations.RemoveField(model_name="cardset", name="emblem_scale"),
    ]
