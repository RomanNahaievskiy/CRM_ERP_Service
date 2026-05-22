from django.db import transaction
from django.utils import timezone

from booking.models import Booking
from booking.services.errors import ServiceError


CANCELABLE_STATUSES = {
    Booking.Status.NEW,
    Booking.Status.CONFIRMED,
}


@transaction.atomic
def cancel_booking_by_id(booking_id, *, reason=""):
    booking = Booking.objects.select_for_update().filter(id=booking_id).first()

    if booking is None:
        raise ServiceError("Booking not found", status=404)

    if booking.status == Booking.Status.CANCELED:
        return booking

    if booking.status not in CANCELABLE_STATUSES:
        raise ServiceError("Booking cannot be canceled in current status", status=409)

    if booking.starts_at <= timezone.now():
        raise ServiceError("Past booking cannot be canceled", status=409)

    booking.status = Booking.Status.CANCELED
    booking.updated_at = timezone.now()

    if reason:
        booking.comment = append_cancel_reason(booking.comment, reason)

    booking.save(update_fields=["status", "comment", "updated_at"])

    return booking


def append_cancel_reason(comment, reason):
    comment = comment.strip()
    reason_line = f"Cancellation reason: {reason}"

    if not comment:
        return reason_line

    return f"{comment}\n{reason_line}"
