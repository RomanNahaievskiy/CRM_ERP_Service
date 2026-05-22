from django.db.models import Count
from django.utils import timezone

from booking.models import Client


def get_clients_payload(limit=200):
    clients = (
        Client.objects.annotate(bookings_count=Count("bookings"))
        .order_by("-last_seen_at", "-created_at")[:limit]
    )

    return {
        "clients": [
            {
                "id": item.id,
                "fullName": item.full_name,
                "phone": item.phone,
                "username": item.username,
                "telegramUserId": item.telegram_user_id,
                "telegramChatId": item.telegram_chat_id,
                "firstSeenAt": serialize_datetime(item.first_seen_at),
                "lastSeenAt": serialize_datetime(item.last_seen_at),
                "createdAt": timezone.localtime(item.created_at).isoformat(),
                "bookingsCount": item.bookings_count,
            }
            for item in clients
        ]
    }


def serialize_datetime(value):
    if value is None:
        return None

    return timezone.localtime(value).isoformat()
