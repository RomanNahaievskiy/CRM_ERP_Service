# Catalog service:// Сервіс каталогу:
# готує довідкові дані для бота/фронтенду у API-дружньому JSON-форматі.
# Він віддає сервіси, транспортні засоби, опції, локації та сервісні пости.

from decimal import Decimal

from operations.models import Location

from booking.models import (
    Service,
    ServiceOffering,
    ServiceOfferingOption,
    ServiceOption,
    ServicePost,
    VehicleGroup,
    VehicleType,
)

from .identifiers import offering_public_id


# Converts Decimal values to JSON-friendly numbers.
# Конвертує значення Decimal у JSON-дружні числа.
def decimal_to_number(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


# Collects active reference data used by the bot/frontend booking flow.
# Зборає активні довідкові дані, які використовуються у процесі бронювання бота/фронтенду.
def get_catalog_payload():
    groups = VehicleGroup.objects.filter(is_active=True)
    vehicle_types = VehicleType.objects.select_related("group").filter(
        is_active=True,
        group__is_active=True,
    )
    services = Service.objects.filter(is_active=True)
    offerings = ServiceOffering.objects.select_related("service", "vehicle_type").filter(
        is_active=True,
        service__is_active=True,
        vehicle_type__is_active=True,
        vehicle_type__group__is_active=True,
    )
    options = ServiceOption.objects.filter(is_active=True)
    offering_options = ServiceOfferingOption.objects.select_related(
        "service_offering",
        "service_offering__service",
        "service_offering__vehicle_type",
        "option",
    ).filter(
        is_active=True,
        service_offering__is_active=True,
        service_offering__service__is_active=True,
        service_offering__vehicle_type__is_active=True,
        service_offering__vehicle_type__group__is_active=True,
        option__is_active=True,
    )
    service_posts = ServicePost.objects.prefetch_related(
        "supported_services",
        "supported_options",
    ).select_related("location").filter(is_active=True)
    locations = Location.objects.filter(is_active=True)

    return {
        "locations": [
            {
                "id": item.id,
                "title": item.title,
                "address": item.address,
                "latitude": decimal_to_number(item.latitude),
                "longitude": decimal_to_number(item.longitude),
                "isDefault": item.is_default,
            }
            for item in locations
        ],
        "vehicleGroups": [
            {
                "id": item.id,
                "title": item.title,
            }
            for item in groups
        ],
        "vehicleTypes": [
            {
                "id": item.id,
                "groupId": item.group_id,
                "title": item.title,
            }
            for item in vehicle_types
        ],
        "services": [
            {
                "id": item.id,
                "title": item.title,
            }
            for item in services
        ],
        "offerings": [
            {
                "id": offering_public_id(item),
                "serviceId": item.service_id,
                "vehicleTypeId": item.vehicle_type_id,
                "price": decimal_to_number(item.price),
                "durationMinutes": item.duration_minutes,
            }
            for item in offerings
        ],
        "options": [
            {
                "id": item.id,
                "title": item.title,
                "price": decimal_to_number(item.price),
                "extraDurationMinutes": item.extra_duration_minutes,
                "applicableGroupId": item.applicable_group_id,
                "applicableVehicleTypeId": item.applicable_vehicle_type_id,
            }
            for item in options
        ],
        "offeringOptions": [
            {
                "offeringId": offering_public_id(item.service_offering),
                "optionId": item.option_id,
                "isRequired": item.is_required,
                "priceOverride": decimal_to_number(item.price_override),
                "extraDurationOverride": item.extra_duration_override,
                "sortOrder": item.sort_order,
            }
            for item in offering_options
        ],
        "servicePosts": [
            {
                "id": item.id,
                "title": item.title,
                "locationId": item.location_id,
                "supportedServiceIds": list(
                    item.supported_services.values_list("id", flat=True)
                ),
                "supportedOptionIds": list(item.supported_options.values_list("id", flat=True)),
            }
            for item in service_posts
        ],
    }
