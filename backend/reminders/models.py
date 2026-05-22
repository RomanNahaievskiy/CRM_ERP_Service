from django.db import models


class ReminderSetting(models.Model):
    title = models.CharField(max_length=120)
    offset_minutes = models.PositiveIntegerField(
        help_text="How many minutes before the booking start this reminder should be sent.",
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "-offset_minutes", "title"]
        constraints = [
            models.UniqueConstraint(
                fields=["offset_minutes"],
                name="unique_reminder_setting_offset_minutes",
            )
        ]

    def __str__(self):
        return f"{self.title} ({self.offset_minutes} min)"


class BookingReminder(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENDING = "sending", "Sending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"

    booking = models.ForeignKey(
        "booking.Booking",
        on_delete=models.CASCADE,
        related_name="reminders",
    )
    setting = models.ForeignKey(
        ReminderSetting,
        on_delete=models.PROTECT,
        related_name="booking_reminders",
    )
    offset_minutes = models.PositiveIntegerField()
    scheduled_at = models.DateTimeField(db_index=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    attempts = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True)
    sent_at = models.DateTimeField(blank=True, null=True)
    claimed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["booking", "setting"],
                name="unique_booking_reminder_per_setting",
            )
        ]
        indexes = [
            models.Index(fields=["status", "scheduled_at"]),
        ]

    def __str__(self):
        return f"{self.booking_id} {self.offset_minutes} min {self.status}"

