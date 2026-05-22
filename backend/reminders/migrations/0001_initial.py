from django.db import migrations, models
import django.db.models.deletion


def seed_default_reminders(apps, schema_editor):
    ReminderSetting = apps.get_model("reminders", "ReminderSetting")
    defaults = [
        ("За добу", 1440, 10),
        ("За 2 години", 120, 20),
        ("За 15 хвилин", 15, 30),
    ]
    for title, offset_minutes, sort_order in defaults:
        ReminderSetting.objects.update_or_create(
            offset_minutes=offset_minutes,
            defaults={
                "title": title,
                "sort_order": sort_order,
                "is_active": True,
            },
        )


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("booking", "0012_deactivate_legacy_tanker_vehicle_types"),
    ]

    operations = [
        migrations.CreateModel(
            name="ReminderSetting",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=120)),
                (
                    "offset_minutes",
                    models.PositiveIntegerField(
                        help_text="How many minutes before the booking start this reminder should be sent."
                    ),
                ),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["sort_order", "-offset_minutes", "title"],
            },
        ),
        migrations.CreateModel(
            name="BookingReminder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("offset_minutes", models.PositiveIntegerField()),
                ("scheduled_at", models.DateTimeField(db_index=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("sending", "Sending"),
                            ("sent", "Sent"),
                            ("failed", "Failed"),
                            ("skipped", "Skipped"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("attempts", models.PositiveIntegerField(default=0)),
                ("last_error", models.TextField(blank=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("claimed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "booking",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reminders",
                        to="booking.booking",
                    ),
                ),
                (
                    "setting",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="booking_reminders",
                        to="reminders.remindersetting",
                    ),
                ),
            ],
            options={
                "ordering": ["scheduled_at", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="remindersetting",
            constraint=models.UniqueConstraint(
                fields=("offset_minutes",),
                name="unique_reminder_setting_offset_minutes",
            ),
        ),
        migrations.AddConstraint(
            model_name="bookingreminder",
            constraint=models.UniqueConstraint(
                fields=("booking", "setting"),
                name="unique_booking_reminder_per_setting",
            ),
        ),
        migrations.AddIndex(
            model_name="bookingreminder",
            index=models.Index(fields=["status", "scheduled_at"], name="reminders_b_status_0a32ff_idx"),
        ),
        migrations.RunPython(seed_default_reminders, migrations.RunPython.noop),
    ]

