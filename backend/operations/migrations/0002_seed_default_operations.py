from datetime import time

from django.db import migrations


def seed_default_operations(apps, schema_editor):
    BusinessSettings = apps.get_model("operations", "BusinessSettings")
    Location = apps.get_model("operations", "Location")
    BusinessHours = apps.get_model("operations", "BusinessHours")

    BusinessSettings.objects.get_or_create(
        title="Default settings",
        defaults={
            "slot_step_minutes": 15,
            "booking_days_ahead": 7,
            "is_active": True,
        },
    )

    location, _ = Location.objects.get_or_create(
        id="main",
        defaults={
            "title": "Main location",
            "is_default": True,
            "is_active": True,
        },
    )

    for weekday in range(7):
        BusinessHours.objects.get_or_create(
            location=location,
            weekday=weekday,
            opens_at=time(hour=8),
            closes_at=time(hour=20),
            defaults={"is_active": True},
        )


class Migration(migrations.Migration):

    dependencies = [
        ("operations", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_default_operations, migrations.RunPython.noop),
    ]
