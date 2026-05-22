# Availability service: // Сервіс доступності: 
# рахує бізнес-доступність для вибраної пропозиції та опцій.
# Він поєднує тривалість бронювання, графік роботи, графіки постів та алокації.

from datetime import datetime, time

from django.utils import timezone

from booking.models import ServiceOffering, ServiceOption
from operations.services import get_schedule_for_date
from pricing.services import resolve_pricing_terms

from .allocation import build_booking_stages, find_allocation_plan
from .errors import ServiceError
from .identifiers import parse_public_offering_id


# Formats minutes from midnight as HH:MM for API responses.
def minutes_to_time(value):
    hours = value // 60
    minutes = value % 60
    return f"{hours:02d}:{minutes:02d}"


# Combines a date and minute offset into a timezone-aware datetime.
def date_time_to_aware(date_value, minutes):
    hours = minutes // 60
    minute = minutes % 60
    naive = datetime.combine(date_value, time(hour=hours, minute=minute))
    return timezone.make_aware(naive, timezone.get_current_timezone())


# Returns public booking slots for a concrete service offering and option set.
def get_available_slots(date_value, service_offering_id, option_ids, vehicle_number="", billing_mode="auto"):
    service_id, vehicle_type_id = parse_public_offering_id(service_offering_id)
    if not service_id or not vehicle_type_id:
        raise ServiceError("Invalid serviceOfferingId", status=400)

    try:
        offering = ServiceOffering.objects.select_related("service").get(
            service_id=service_id,
            vehicle_type_id=vehicle_type_id,
            is_active=True,
            service__is_active=True,
            vehicle_type__is_active=True,
        )
    except ServiceOffering.DoesNotExist as exc:
        raise ServiceError("Service offering not found", status=404) from exc

    options = list(ServiceOption.objects.filter(id__in=option_ids, is_active=True))
    if len(options) != len(set(option_ids)):
        raise ServiceError("One or more options were not found", status=400)

    pricing = resolve_pricing_terms(
        {
            "serviceOfferingId": service_offering_id,
            "optionIds": option_ids,
            "vehicleNumber": vehicle_number,
            "billingMode": billing_mode,
        }
    )
    option_duration_minutes_by_id = {
        item["id"]: item["extraDurationMinutes"]
        for item in pricing["optionItems"]
    }

    slots = []
    now = timezone.localtime()
    total_duration_minutes = pricing["totalDurationMinutes"]
    schedule = get_schedule_for_date(date_value)

    for window_start, window_end in schedule.working_windows:
        current = window_start
        while current + total_duration_minutes <= window_end:
            starts_at = date_time_to_aware(date_value, current)
            stages = build_booking_stages(
                offering,
                options,
                starts_at,
                service_duration_minutes=pricing["serviceDurationMinutes"],
                option_duration_minutes_by_id=option_duration_minutes_by_id,
            )
            has_available_plan = find_allocation_plan(stages) is not None

            if has_available_plan and starts_at > now:
                slots.append(minutes_to_time(current))

            current += schedule.slot_step_minutes

    return slots
