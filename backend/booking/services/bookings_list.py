from django.db.models import Prefetch
from django.utils import timezone

from booking.models import Booking, BookingPostAllocation


def get_bookings_payload(limit=100):
    allocations = BookingPostAllocation.objects.select_related(
        "service_post",
        "service",
        "service_option",
    ).order_by("starts_at", "sort_order")
    bookings = Booking.objects.select_related(
        "client",
        "service_offering",
        "service_offering__service",
        "service_offering__vehicle_type",
        "service_post",
    ).prefetch_related(
        "options",
        Prefetch("post_allocations", queryset=allocations),
    ).order_by("-starts_at")[:limit]

    return {
        "bookings": [
            {
                "id": item.id,
                "externalId": item.external_id,
                "startsAt": timezone.localtime(item.starts_at).isoformat(),
                "endsAt": timezone.localtime(item.ends_at).isoformat(),
                "status": item.status,
                "clientType": item.client_type,
                "vehicleNumber": item.vehicle_number,
                "clientName": item.client.full_name if item.client else "",
                "clientPhone": item.client.phone if item.client else "",
                "serviceTitle": item.service_offering.service.title,
                "vehicleTypeTitle": item.service_offering.vehicle_type.title,
                "postId": item.service_post.id if item.service_post else "",
                "postTitle": item.service_post.title if item.service_post else "",
                "totalPrice": float(item.total_price) if item.total_price is not None else None,
                "comment": item.comment,
                "admin": item.admin,
                "options": [
                    {
                        "id": option.id,
                        "title": option.title
                    }
                    for option in item.options.all()
                ],
                "allocations": [
                    {
                        "id": allocation.id,
                        "startsAt": timezone.localtime(allocation.starts_at).isoformat(),
                        "endsAt": timezone.localtime(allocation.ends_at).isoformat(),
                        "sortOrder": allocation.sort_order,
                        "postId": allocation.service_post.id,
                        "postTitle": allocation.service_post.title,
                        "serviceTitle": allocation.service.title if allocation.service else "",
                        "optionTitle": allocation.service_option.title if allocation.service_option else "",
                    }
                    for allocation in item.post_allocations.all()
                ],
            }
            for item in bookings
        ]
    }

