# Written by hand: the pack front becomes one stack of layers, the built-in
# lockup becomes a layer in it rather than an either/or with artwork, and the
# separate "placed or full" fit goes away now that a layer's scale can reach far
# enough to cover the wrapper on its own.

from django.db import migrations, models


def to_layers(apps, schema_editor):
    """Fold pack_art_mode and pack_images into one stack.

    A set showing artwork keeps its images visible and gains a hidden lockup, so
    the badge can be brought back without redesigning it. A set showing the
    lockup gets the reverse. The lockup goes on top, where a brand mark belongs.
    """
    CardSet = apps.get_model("cards", "CardSet")
    for card_set in CardSet.objects.iterator():
        showing_art = card_set.pack_art_mode == "custom"
        layers = []
        for old in card_set.pack_images or []:
            layers.append(
                {
                    "kind": "image",
                    "image_id": old.get("image_id", ""),
                    "hidden": not showing_art,
                    "scale": old.get("scale", 70),
                    "x": old.get("x", 0),
                    "y": old.get("y", 0),
                    "rotate": old.get("rotate", 0),
                    "flip_x": old.get("flip_x", False),
                    "flip_y": old.get("flip_y", False),
                    "opacity": old.get("opacity", 100),
                }
            )
        layers.append(
            {
                "kind": "emblem",
                "image_id": "",
                "hidden": showing_art,
                "scale": 100,
                "x": 0,
                "y": 0,
                "rotate": 0,
                "flip_x": False,
                "flip_y": False,
                "opacity": 100,
            }
        )
        card_set.pack_layers = layers
        card_set.save(update_fields=["pack_layers"])


def to_images(apps, schema_editor):
    """Back out: visible image layers become pack_images, and whether the lockup
    was showing becomes pack_art_mode again."""
    CardSet = apps.get_model("cards", "CardSet")
    for card_set in CardSet.objects.iterator():
        images = []
        emblem_hidden = False
        for layer in card_set.pack_layers or []:
            if layer.get("kind") == "emblem":
                emblem_hidden = layer.get("hidden", False)
                continue
            if layer.get("hidden"):
                continue
            images.append(
                {
                    "image_id": layer.get("image_id", ""),
                    "fit": "placed",
                    "scale": min(layer.get("scale", 70), 200),
                    "x": layer.get("x", 0),
                    "y": layer.get("y", 0),
                    "rotate": layer.get("rotate", 0),
                    "flip_x": layer.get("flip_x", False),
                    "flip_y": layer.get("flip_y", False),
                    "opacity": layer.get("opacity", 100),
                }
            )
        card_set.pack_images = images
        card_set.pack_art_mode = "custom" if emblem_hidden and images else "emblem"
        card_set.save(update_fields=["pack_images", "pack_art_mode"])


class Migration(migrations.Migration):
    dependencies = [
        ("cards", "0007_pack_images"),
    ]

    operations = [
        migrations.AddField(
            model_name="cardset",
            name="pack_layers",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(to_layers, to_images),
        migrations.RemoveField(model_name="cardset", name="pack_images"),
        migrations.RemoveField(model_name="cardset", name="pack_art_mode"),
    ]
