from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("uploads", "0002_alter_image_kind")]

    operations = [
        migrations.AddField(
            model_name="image",
            name="source_metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
