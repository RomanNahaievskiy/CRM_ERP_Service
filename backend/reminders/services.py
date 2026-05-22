from datetime import timedelta

from django.db import models, transaction
from django.utils import timezone

from booking.models import Booking

from .models import BookingReminder, ReminderSetting


ACTIVE_BOOKING_STATUSES = [Booking.Status.NEW, Booking.Status.CONFIRMED]


def schedule_reminders_for_booking(booking):
    if not can_receive_reminders(booking):
        return []

    now = timezone.now()
    reminders = []
    for setting in ReminderSetting.objects.filter(is_active=True):
        scheduled_at = booking.starts_at - timedelta(minutes=setting.offset_minutes)
        if scheduled_at <= now:
            continue

        reminder, _ = BookingReminder.objects.get_or_create(
            booking=booking,
            setting=setting,
            defaults={
                "offset_minutes": setting.offset_minutes,
                "scheduled_at": scheduled_at,
            },
        )
        if reminder.status in [BookingReminder.Status.PENDING, BookingReminder.Status.FAILED]:
            if reminder.offset_minutes != setting.offset_minutes or reminder.scheduled_at != scheduled_at:
                reminder.offset_minutes = setting.offset_minutes
                reminder.scheduled_at = scheduled_at
                reminder.save(update_fields=["offset_minutes", "scheduled_at", "updated_at"])
        reminders.append(reminder)

    return reminders


def ensure_upcoming_booking_reminders():
    bookings = (
        Booking.objects.select_related("client")
        .filter(
            starts_at__gt=timezone.now(),
            status__in=ACTIVE_BOOKING_STATUSES,
            client__telegram_chat_id__isnull=False,
        )
        .exclude(client__telegram_chat_id=0)
    )
    for booking in bookings:
        schedule_reminders_for_booking(booking)


def claim_due_reminders(limit=20):
    ensure_upcoming_booking_reminders()

    now = timezone.now()
    with transaction.atomic():
        reminders = list(
            BookingReminder.objects.select_for_update()
            .select_related(
                "booking",
                "booking__client",
                "booking__service_offering__service",
                "booking__service_offering__vehicle_type",
                "booking__service_post",
                "booking__service_post__location",
            )
            .filter(
                status__in=[BookingReminder.Status.PENDING, BookingReminder.Status.FAILED],
                scheduled_at__lte=now,
                booking__created_at__lte=models.F("scheduled_at"),
                booking__starts_at__gt=now,
                booking__status__in=ACTIVE_BOOKING_STATUSES,
                booking__client__telegram_chat_id__isnull=False,
                setting__is_active=True,
            )
            .exclude(booking__client__telegram_chat_id=0)
            .order_by("scheduled_at", "id")[:limit]
        )

        ids = [reminder.id for reminder in reminders]
        BookingReminder.objects.filter(id__in=ids).update(
            status=BookingReminder.Status.SENDING,
            claimed_at=now,
            attempts=models.F("attempts") + 1,
            last_error="",
        )

    return reminders


def mark_reminder_sent(reminder_id):
    return BookingReminder.objects.filter(id=reminder_id).update(
        status=BookingReminder.Status.SENT,
        sent_at=timezone.now(),
        last_error="",
    )


def mark_reminder_failed(reminder_id, error):
    return BookingReminder.objects.filter(id=reminder_id).update(
        status=BookingReminder.Status.FAILED,
        last_error=str(error)[:2000],
    )


def can_receive_reminders(booking):
    return (
        booking.starts_at > timezone.now()
        and booking.status in ACTIVE_BOOKING_STATUSES
        and booking.client is not None
        and booking.client.telegram_chat_id
    )
