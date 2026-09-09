from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("cards", "0011_cardset_binder_colour")]

    operations = [
        migrations.AddField(
            model_name="cardset",
            name="render_back_key",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="cardset",
            name="render_back_signature",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="carddefinition",
            name="render_front_key",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="carddefinition",
            name="render_front_thumbnail_key",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="carddefinition",
            name="render_mask_key",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="carddefinition",
            name="render_mask_thumbnail_key",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="carddefinition",
            name="render_signature",
            field=models.CharField(blank=True, max_length=64),
        ),
    ]
