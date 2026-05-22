# Booking creation service: // Сервіс створення бронювання:
# Валідує дані бронювання, створює або оновлює клієнта, 
# створює бронювання та резервує вибрані сервісні пости в одній транзакції.


from datetime import timedelta
import re
from uuid import uuid4

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from booking.models import Booking, Client, ServiceOffering, ServiceOption
from common.normalization import normalize_phone_number
from pricing.services import resolve_pricing_terms

from .allocation import build_booking_stages, create_allocations, find_allocation_plan
from .errors import ServiceError
from .identifiers import parse_public_offering_id

IDEMPOTENCY_KEY_RE = re.compile(r"^[A-Za-z0-9_-]{8,60}$")


# Parses API datetime input and normalizes it to the project timezone.
# Розбирає API-вхід datetime і нормалізує його до часового пояса проекта.
def parse_datetime_value(value):
    if not isinstance(value, str):
        return None

    parsed = parse_datetime(value)
    if parsed is None:
        return None

    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone.get_current_timezone())

    return parsed


# Validates payload, creates booking data, and reserves post allocations.
# Валідує дані, створює бронювання та резервує пости.
def create_booking_from_payload(payload):
    external_id = external_id_from_idempotency_key(payload.get("idempotencyKey"))
    if external_id:
        existing_booking = find_booking_by_external_id(external_id)
        if existing_booking:
            return existing_booking

    service_id, vehicle_type_id = parse_public_offering_id(payload.get("serviceOfferingId"))
    if not service_id or not vehicle_type_id:
        raise ServiceError("Invalid serviceOfferingId", status=400)

    starts_at = parse_datetime_value(payload.get("startsAt"))
    ends_at = parse_datetime_value(payload.get("endsAt"))
    if not starts_at or not ends_at:
        raise ServiceError("Invalid startsAt or endsAt", status=400)

    if ends_at <= starts_at:
        raise ServiceError("endsAt must be after startsAt", status=400)

    try:
        offering = ServiceOffering.objects.get(
            service_id=service_id,
            vehicle_type_id=vehicle_type_id,
            is_active=True,
            service__is_active=True,
            vehicle_type__is_active=True,
        )
    except ServiceOffering.DoesNotExist as exc:
        raise ServiceError("Service offering not found", status=404) from exc

    option_ids = payload.get("optionIds") or []
    if not isinstance(option_ids, list):
        raise ServiceError("optionIds must be a list", status=400)

    options = list(ServiceOption.objects.filter(id__in=option_ids, is_active=True))
    if len(options) != len(set(option_ids)):
        raise ServiceError("One or more options were not found", status=400)

    pricing = resolve_pricing_terms(
        {
            "serviceOfferingId": payload.get("serviceOfferingId"),
            "optionIds": option_ids,
            "vehicleNumber": payload.get("vehicleNumber") or "",
            "billingMode": payload.get("billingMode") or "auto",
        }
    )
    option_duration_minutes_by_id = {
        item["id"]: item["extraDurationMinutes"]
        for item in pricing["optionItems"]
    }
    expected_ends_at = starts_at + timedelta(minutes=pricing["totalDurationMinutes"])
    if ends_at != expected_ends_at:
        raise ServiceError("endsAt does not match service and options duration", status=400)

    now = timezone.now()
    telegram_user_id = payload.get("telegramUserId")
    normalized_phone = normalize_phone_number(payload.get("phone") or "")
    if payload.get("phone") and not normalized_phone:
        raise ServiceError("Invalid phone number", status=400)

    try:
        with transaction.atomic():
            stages = build_booking_stages(
                offering,
                options,
                starts_at,
                service_duration_minutes=pricing["serviceDurationMinutes"],
                option_duration_minutes_by_id=option_duration_minutes_by_id,
            )
            allocation_plan = find_allocation_plan(
                stages,
                lock=True,
                first_stage_post_id=payload.get("firstStagePostId")
                or payload.get("servicePostId")
                or payload.get("preferredPostId"),
            )
            if allocation_plan is None:
                raise ServiceError(
                    "No available service post route for this time and option set",
                    status=409,
                )

            client = resolve_client(payload, telegram_user_id, now, normalized_phone)
            booking = Booking.objects.create(
                external_id=external_id or f"bot-{uuid4().hex[:12]}",
                client=client,
                service_offering=offering,
                service_post=allocation_plan[0]["service_post"],
                vehicle_number=payload.get("vehicleNumber") or "",
                starts_at=starts_at,
                ends_at=ends_at,
                status=Booking.Status.NEW,
                client_type=Booking.ClientType.CONTRACT
                if pricing["billingMode"] == "contract"
                else Booking.ClientType.RETAIL,
                total_price=pricing["totalPrice"],
                total_duration_minutes=pricing["totalDurationMinutes"],
                comment=payload.get("comment") or "",
            )
            booking.options.set(options)
            create_allocations(booking, allocation_plan)
            from reminders.services import schedule_reminders_for_booking

            schedule_reminders_for_booking(booking)
    except IntegrityError:
        if external_id:
            existing_booking = find_booking_by_external_id(external_id)
            if existing_booking:
                return existing_booking
        raise

    return booking


def external_id_from_idempotency_key(value):
    if value in (None, ""):
        return ""
    if not isinstance(value, str) or not IDEMPOTENCY_KEY_RE.fullmatch(value):
        raise ServiceError("Invalid idempotencyKey", status=400)

    return f"bot-{value}"


def find_booking_by_external_id(external_id):
    return (
        Booking.objects.select_related("service_post", "service_post__location")
        .filter(external_id=external_id)
        .first()
    )


# Finds or creates the client record represented by the bot payload.
# Знаходить або створює запис клієнта, представленного даними бота.
def resolve_client(payload, telegram_user_id, now, normalized_phone):
    if telegram_user_id:
        client, created = Client.objects.get_or_create(
            telegram_user_id=telegram_user_id,
            defaults={
                "first_seen_at": now,
            },
        )
        if created or not client.first_seen_at:
            client.first_seen_at = now
        client.last_seen_at = now
        client.telegram_chat_id = payload.get("telegramChatId") or client.telegram_chat_id
        client.phone = normalized_phone or client.phone
        client.full_name = payload.get("fullName") or client.full_name
        client.username = payload.get("username") or client.username
        client.save()
        return client

    if normalized_phone:
        return Client.objects.create(
            phone=normalized_phone,
            full_name=payload.get("fullName", ""),
            first_seen_at=now,
            last_seen_at=now,
        )

    return None
