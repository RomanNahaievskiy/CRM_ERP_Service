from django.db import transaction
from django.utils import timezone

from booking.models import Booking
from booking.services.errors import ServiceError


NO_SHOW_ALLOWED_STATUSES = {
    Booking.Status.NEW,
    Booking.Status.CONFIRMED,
}


@transaction.atomic
def mark_booking_no_show_by_id(booking_id):
    booking = Booking.objects.select_for_update().filter(id=booking_id).first()

    if booking is None:
        raise ServiceError("Booking not found", status=404)

    if booking.status == Booking.Status.NO_SHOW:
        return booking

    if booking.status not in NO_SHOW_ALLOWED_STATUSES:
        raise ServiceError("Booking cannot be marked as no-show in current status", status=409)

    if booking.ends_at >= timezone.now():
        raise ServiceError("Future booking cannot be marked as no-show", status=409)

    booking.status = Booking.Status.NO_SHOW
    booking.save(update_fields=["status", "updated_at"])

    return booking
