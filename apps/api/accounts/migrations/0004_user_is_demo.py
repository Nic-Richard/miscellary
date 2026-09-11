from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0003_profile_binder_colour")]

    operations = [
        migrations.AddField(
            model_name="user",
            name="is_demo",
            field=models.BooleanField(default=False),
        ),
    ]
