from django.db import migrations


def assign_default_post_to_existing_bookings(apps, schema_editor):
    Booking = apps.get_model("booking", "Booking")
    ServicePost = apps.get_model("booking", "ServicePost")
    default_post, _ = ServicePost.objects.get_or_create(
        id="post_1",
        defaults={
            "title": "Пост 1",
            "sort_order": 1,
            "is_active": True,
        },
    )
    Booking.objects.filter(service_post__isnull=True).update(service_post=default_post)


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0004_servicepost_booking_service_post"),
    ]

    operations = [
        migrations.RunPython(assign_default_post_to_existing_bookings, migrations.RunPython.noop),
    ]
