from django.db import migrations


def add_other_transport_type(apps, schema_editor):
    VehicleGroup = apps.get_model("booking", "VehicleGroup")
    VehicleType = apps.get_model("booking", "VehicleType")

    group, _ = VehicleGroup.objects.update_or_create(
        id="other",
        defaults={
            "title": "Інший",
            "is_active": True,
        },
    )
    VehicleType.objects.update_or_create(
        id="other_vehicle",
        defaults={
            "group": group,
            "title": "Інший транспорт",
            "is_active": True,
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0007_servicepost_supported_services_bookingpostallocation"),
    ]

    operations = [
        migrations.RunPython(add_other_transport_type, migrations.RunPython.noop),
    ]
