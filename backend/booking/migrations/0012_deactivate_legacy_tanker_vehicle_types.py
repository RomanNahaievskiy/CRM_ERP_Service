from django.db import migrations


LEGACY_TANKER_VEHICLE_TYPE_IDS = (
    "tanker_outside",
    "tanker_inside",
)


def deactivate_legacy_tanker_vehicle_types(apps, schema_editor):
    VehicleType = apps.get_model("booking", "VehicleType")
    ServiceOffering = apps.get_model("booking", "ServiceOffering")

    legacy_vehicle_types = VehicleType.objects.filter(
        id__in=LEGACY_TANKER_VEHICLE_TYPE_IDS,
    )
    legacy_vehicle_types.update(is_active=False)

    ServiceOffering.objects.filter(
        vehicle_type_id__in=LEGACY_TANKER_VEHICLE_TYPE_IDS,
    ).update(is_active=False)


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0011_booking_normalized_vehicle_number"),
    ]

    operations = [
        migrations.RunPython(
            deactivate_legacy_tanker_vehicle_types,
            migrations.RunPython.noop,
        ),
    ]
