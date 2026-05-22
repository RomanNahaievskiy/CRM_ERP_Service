from django.db import migrations


def assign_default_location_to_posts(apps, schema_editor):
    Location = apps.get_model("operations", "Location")
    ServicePost = apps.get_model("booking", "ServicePost")

    location = (
        Location.objects.filter(is_active=True, is_default=True).first()
        or Location.objects.filter(is_active=True).first()
    )
    if location is None:
        return

    ServicePost.objects.filter(location__isnull=True).update(location=location)


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0009_servicepost_location"),
        ("operations", "0002_seed_default_operations"),
    ]

    operations = [
        migrations.RunPython(assign_default_location_to_posts, migrations.RunPython.noop),
    ]
