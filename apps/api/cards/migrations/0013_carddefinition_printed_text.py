from django.db import migrations, models


def copy_printed_text(apps, schema_editor):
    CardDefinition = apps.get_model("cards", "CardDefinition")
    for card in CardDefinition.objects.all().iterator():
        lines = [line.strip() for line in card.description.splitlines() if line.strip()]
        if not lines:
            continue
        limits = {
            "classic": 48,
            "minimal": 70,
            "bold": 54,
            "fieldnote": 140,
            "dossier": 140,
        }
        limit = limits.get(card.template_key)
        if limit is None:
            continue
        if card.template_key in {"fieldnote", "dossier"}:
            printed = card.description[:limit]
        else:
            printed = lines[0].lstrip("-* ")[:limit]
        card.printed_text = printed
        card.save(update_fields=["printed_text"])


class Migration(migrations.Migration):
    dependencies = [("cards", "0012_card_render_cache")]

    operations = [
        migrations.AddField(
            model_name="carddefinition",
            name="printed_text",
            field=models.TextField(blank=True, max_length=140),
        ),
        migrations.RunPython(copy_printed_text, migrations.RunPython.noop),
    ]
