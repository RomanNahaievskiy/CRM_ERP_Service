import json

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from operations.models import OperatorContact

from .services import claim_due_reminders, mark_reminder_failed, mark_reminder_sent


@csrf_exempt
@require_POST
def claim_due(request):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    limit = payload.get("limit", 20)
    if not isinstance(limit, int) or limit < 1 or limit > 100:
        return JsonResponse({"error": "limit must be an integer from 1 to 100"}, status=400)

    reminders = claim_due_reminders(limit=limit)
    return JsonResponse({"reminders": [serialize_reminder(reminder) for reminder in reminders]})


@csrf_exempt
@require_POST
def mark_sent(request, reminder_id):
    updated = mark_reminder_sent(reminder_id)
    if not updated:
        return JsonResponse({"error": "Reminder not found"}, status=404)

    return JsonResponse({"ok": True})


@csrf_exempt
@require_POST
def mark_failed(request, reminder_id):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    updated = mark_reminder_failed(reminder_id, payload.get("error") or "Unknown error")
    if not updated:
        return JsonResponse({"error": "Reminder not found"}, status=404)

    return JsonResponse({"ok": True})


def serialize_reminder(reminder):
    booking = reminder.booking
    client = booking.client
    service_post = booking.service_post
    location = service_post.location if service_post else None

    return {
        "id": reminder.id,
        "offsetMinutes": reminder.offset_minutes,
        "scheduledAt": timezone.localtime(reminder.scheduled_at).isoformat(),
        "booking": {
            "id": booking.id,
            "externalId": booking.external_id,
            "startsAt": timezone.localtime(booking.starts_at).isoformat(),
            "endsAt": timezone.localtime(booking.ends_at).isoformat(),
            "vehicleNumber": booking.vehicle_number,
            "serviceTitle": booking.service_offering.service.title,
            "vehicleTypeTitle": booking.service_offering.vehicle_type.title,
            "servicePostTitle": service_post.title if service_post else "",
            "location": {
                "title": location.title,
                "address": location.address,
                "latitude": float(location.latitude) if location.latitude is not None else None,
                "longitude": float(location.longitude) if location.longitude is not None else None,
            }
            if location
            else None,
            "operator": serialize_operator(location),
        },
        "client": {
            "telegramChatId": client.telegram_chat_id,
            "fullName": client.full_name,
        },
    }


def serialize_operator(location):
    contacts = OperatorContact.objects.filter(is_active=True)
    if location is not None:
        contacts = contacts.filter(location=location)

    contact = contacts.order_by("-is_primary", "title").first()
    if contact is None and location is not None:
        contact = (
            OperatorContact.objects.filter(is_active=True)
            .order_by("-is_primary", "title")
            .first()
        )
    if contact is None:
        return None

    return {
        "title": contact.title,
        "phone": contact.phone,
        "telegramUsername": contact.telegram_username,
    }
