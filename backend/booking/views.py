import json

from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from operations.models import OperatorContact

from .services.availability import get_available_slots
from .services.booking_creation import create_booking_from_payload
from .services.bookings_list import get_bookings_payload
from .services.booking_cancellation import cancel_booking_by_id
from .services.booking_no_show import mark_booking_no_show_by_id

from .services.catalog import get_catalog_payload
from .services.client_messages import send_client_message
from .services.clients import get_client_contact_by_telegram_id
from .services.clients_list import get_clients_payload
from .services.dashboard_stats import get_bookings_stat
from .services.errors import ServiceError


def option_ids_from_query(request):
    option_ids = request.GET.getlist("optionIds")
    if option_ids:
        return [item for item in option_ids if item]

    raw = request.GET.get("optionIds", "")
    return [item for item in raw.split(",") if item]


@require_GET
def catalog(request):
    # View відповідає тільки за HTTP; збір каталогу живе у service-шарі.
    return JsonResponse(get_catalog_payload())

@require_GET
def booking_stats(request):
    return JsonResponse(get_bookings_stat())
    

@require_GET
def client_by_telegram(request, telegram_user_id):
    # View тільки віддає контактний snapshot; пошук клієнта живе у service-шарі.
    return JsonResponse(get_client_contact_by_telegram_id(telegram_user_id))


@require_GET
def clients(request):
    return JsonResponse(get_clients_payload())


@csrf_exempt
@require_POST
def client_messages(request, client_id):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    try:
        result = send_client_message(client_id, payload.get("text"))
    except ServiceError as exc:
        return JsonResponse({"error": exc.message}, status=exc.status)

    return JsonResponse(result)


@require_GET
def availability(request):
    date_value = parse_date(request.GET.get("date", ""))
    if date_value is None:
        return JsonResponse({"error": "Invalid date"}, status=400)

    try:
        # Service-шар рахує бізнес-доступність, а view лише віддає JSON-відповідь.
        slots = get_available_slots(
            date_value=date_value,
            service_offering_id=request.GET.get("serviceOfferingId"),
            option_ids=option_ids_from_query(request),
            vehicle_number=request.GET.get("vehicleNumber", ""),
            billing_mode=request.GET.get("billingMode", "auto"),
        )
    except ServiceError as exc:
        return JsonResponse({"error": exc.message}, status=exc.status)

    return JsonResponse({"date": date_value.isoformat(), "slots": slots})
# віддає інформацію про бронювання; логіка вибірки та формування даних потрібно реалізувати у service-шарі.

    

    

# @csrf_exempt  # Бронювання створюється зовнішнім клієнтом, який не має CSRF-токена. Якщо в майбутньому з'явиться frontend, потрібно буде додати окрему view для нього з CSRF-захистом.
# @require_POST
@require_GET
def list_bookings(request):
    return JsonResponse(get_bookings_payload())


@csrf_exempt
@require_http_methods(["GET", "POST"])
def bookings(request):
    if request.method == "GET":
        return list_bookings(request)

    return create_booking(request)


@csrf_exempt
@require_POST
def create_booking(request):
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    try:
        # Уся транзакційна логіка створення бронювання винесена з view у services.
        booking = create_booking_from_payload(payload)
    except ServiceError as exc:
        return JsonResponse({"error": exc.message}, status=exc.status)

    return JsonResponse(
        {
            "id": booking.external_id,
            "bookingId": booking.id,
            "startsAt": timezone.localtime(booking.starts_at).isoformat(),
            "location": serialize_booking_location(booking),
            "operator": serialize_booking_operator(booking),
        },
        status=201,
    )


def serialize_booking_location(booking):
    location = booking.service_post.location if booking.service_post else None
    if location is None:
        return None

    return {
        "id": location.id,
        "title": location.title,
        "address": location.address,
        "latitude": float(location.latitude) if location.latitude is not None else None,
        "longitude": float(location.longitude) if location.longitude is not None else None,
    }


def serialize_booking_operator(booking):
    location = booking.service_post.location if booking.service_post else None
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

#
# Додаткові view для редагування та скасування бронювання можна 
# реалізувати за аналогією з create_booking, використовуючи 
# відповідні методи HTTP (PUT/PATCH для редагування, DELETE для скасування) 
# та відповідні сервіси для обробки логіки.
def edit_booking(request, booking_id):
    # Логіка редагування бронювання буде реалізована у service-шарі.
    pass

      # cancel_booking_by_id(booking_id, reason="Canceled via API")  # Приклад пичини скасування, можна розширити для прийому з запиту.

@csrf_exempt
@require_POST
def cancel_booking(request, booking_id):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    try:
        booking = cancel_booking_by_id(
            booking_id,
            reason=payload.get("reason", ""),
        )
    except ServiceError as exc:
        return JsonResponse({"error": exc.message}, status=exc.status)

    return JsonResponse(
        {
            "booking": {
                "id": booking.id,
                "externalId": booking.external_id,
                "status": booking.status,
                "startsAt": timezone.localtime(booking.starts_at).isoformat(),
                "endsAt": timezone.localtime(booking.ends_at).isoformat(),
            }
        }
    )


@csrf_exempt
@require_POST
def mark_booking_no_show(request, booking_id):
    try:
        booking = mark_booking_no_show_by_id(booking_id)
    except ServiceError as exc:
        return JsonResponse({"error": exc.message}, status=exc.status)

    return JsonResponse(
        {
            "booking": {
                "id": booking.id,
                "externalId": booking.external_id,
                "status": booking.status,
                "startsAt": timezone.localtime(booking.starts_at).isoformat(),
                "endsAt": timezone.localtime(booking.ends_at).isoformat(),
            }
        }
    )

