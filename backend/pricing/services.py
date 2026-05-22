# Pricing service:
# resolves retail or contract commercial terms for one booking draft.
# Booking and bot-facing APIs use this module instead of calculating prices locally.
from decimal import Decimal

from django.utils import timezone

from booking.models import ServiceOffering, ServiceOfferingOption
from booking.services.errors import ServiceError
from booking.services.identifiers import offering_public_id, parse_public_offering_id
from common.normalization import normalize_vehicle_number
from contracts.models import Contract, ContractOptionRule, ContractServiceRule, ContractVehicle
from pricing.models import PriceList, ServiceOfferingPrice, ServiceOptionPrice


# Main entry point for bot/API pricing checks.
def resolve_pricing_terms(payload):
    option_ids = payload.get("optionIds") or []
    if not isinstance(option_ids, list):
        raise ServiceError("optionIds must be a list", status=400)

    vehicle_number = normalize_vehicle_number(payload.get("vehicleNumber"))
    matched_contract_vehicle = find_contract_vehicle(vehicle_number)
    contract_unavailable_reason = get_contract_unavailable_reason(matched_contract_vehicle)
    contract_vehicle = None if contract_unavailable_reason else matched_contract_vehicle
    raw_billing_mode = payload.get("billingMode")
    if contract_unavailable_reason and raw_billing_mode == "contract":
        raw_billing_mode = "retail"
    billing_mode = resolve_billing_mode(raw_billing_mode, contract_vehicle)
    if (
        not payload.get("serviceOfferingId")
        and not payload.get("vehicleTypeId")
        and contract_vehicle is None
    ):
        return build_unmatched_vehicle_response(
            payload,
            billing_mode,
            matched_contract_vehicle=matched_contract_vehicle,
            contract_unavailable_reason=contract_unavailable_reason,
        )

    try:
        offering = resolve_offering(payload, contract_vehicle)
    except ServiceError as exc:
        is_contract_lookup = contract_vehicle is not None and not payload.get("serviceOfferingId")
        if exc.message == "Service offering not found" and is_contract_lookup:
            return build_unmatched_vehicle_response(
                payload,
                "retail",
                matched_contract_vehicle=matched_contract_vehicle,
                contract_unavailable_reason="service_offering_not_found",
            )
        raise
    if contract_vehicle is not None:
        validate_contract_vehicle_offering(contract_vehicle, offering)

    offering_option_links = resolve_offering_option_links(offering, option_ids)
    options = [item.option for item in offering_option_links]

    contract = contract_vehicle.contract if billing_mode == "contract" and contract_vehicle else None
    service_rule = find_service_rule(contract, offering) if contract else None
    if service_rule and not service_rule.is_allowed:
        raise ServiceError("Service is not allowed by contract", status=403)

    retail_price_list = get_default_retail_price_list()

    service_price = get_service_offering_price(offering, retail_price_list)
    service_duration = offering.duration_minutes
    if service_rule:
        service_price = service_rule.custom_price if service_rule.custom_price is not None else service_price
        service_duration = (
            service_rule.custom_duration_minutes
            if service_rule.custom_duration_minutes is not None
            else service_duration
        )

    option_items = [
        build_option_item(link, contract, retail_price_list)
        for link in offering_option_links
    ]
    total_price = service_price + sum(item["price_decimal"] for item in option_items)
    total_duration = service_duration + sum(item["duration_minutes"] for item in option_items)

    return {
        "billingMode": billing_mode,
        "contractFound": contract_vehicle is not None,
        "contractMatched": matched_contract_vehicle is not None,
        "contractUnavailableReason": None,
        "contract": serialize_contract(contract_vehicle.contract) if contract_vehicle else None,
        "vehicle": serialize_contract_vehicle(contract_vehicle) if contract_vehicle else None,
        "offeringId": offering_public_id(offering),
        "serviceId": offering.service_id,
        "vehicleTypeId": offering.vehicle_type_id,
        "vehicleGroupId": offering.vehicle_type.group_id,
        "servicePrice": decimal_to_number(service_price),
        "serviceDurationMinutes": service_duration,
        "optionItems": [
            {
                "id": item["id"],
                "title": item["title"],
                "price": decimal_to_number(item["price_decimal"]),
                "extraDurationMinutes": item["duration_minutes"],
            }
            for item in option_items
        ],
        "totalPrice": decimal_to_number(total_price),
        "totalDurationMinutes": total_duration,
    }


# Returns a lightweight response when no contract vehicle was found yet.
def build_unmatched_vehicle_response(
    payload,
    billing_mode,
    matched_contract_vehicle=None,
    contract_unavailable_reason=None,
):
    return {
        "billingMode": "retail" if contract_unavailable_reason else billing_mode,
        "contractFound": False,
        "contractMatched": matched_contract_vehicle is not None,
        "contractUnavailableReason": contract_unavailable_reason,
        "contract": serialize_contract(matched_contract_vehicle.contract)
        if matched_contract_vehicle
        else None,
        "vehicle": serialize_contract_vehicle(matched_contract_vehicle)
        if matched_contract_vehicle
        else None,
        "offeringId": None,
        "serviceId": payload.get("serviceId"),
        "vehicleTypeId": None,
        "vehicleGroupId": None,
        "servicePrice": 0,
        "serviceDurationMinutes": 0,
        "optionItems": [],
        "totalPrice": 0,
        "totalDurationMinutes": 0,
    }


# Picks contract mode automatically only when an active contract vehicle is usable.
def resolve_billing_mode(raw_mode, contract_vehicle):
    if raw_mode == "retail":
        return "retail"
    if raw_mode == "contract":
        if contract_vehicle is None:
            raise ServiceError("Contract vehicle not found", status=404)
        return "contract"
    return "contract" if contract_vehicle else "retail"


# Resolves the concrete ServiceOffering from explicit offering id or contract vehicle type.
def resolve_offering(payload, contract_vehicle):
    service_offering_id = payload.get("serviceOfferingId")
    if service_offering_id:
        service_id, vehicle_type_id = parse_public_offering_id(service_offering_id)
        if not service_id or not vehicle_type_id:
            raise ServiceError("Invalid serviceOfferingId", status=400)
    else:
        service_id = payload.get("serviceId")
        vehicle_type_id = contract_vehicle.vehicle_type_id if contract_vehicle else payload.get("vehicleTypeId")
        if not service_id or not vehicle_type_id:
            raise ServiceError("serviceId and vehicle type are required", status=400)

    try:
        return ServiceOffering.objects.select_related(
            "service",
            "vehicle_type",
            "vehicle_type__group",
        ).get(
            service_id=service_id,
            vehicle_type_id=vehicle_type_id,
            is_active=True,
            service__is_active=True,
            vehicle_type__is_active=True,
        )
    except ServiceOffering.DoesNotExist as exc:
        raise ServiceError("Service offering not found", status=404) from exc


# Prevents an active contract vehicle from being booked under another vehicle type.
def validate_contract_vehicle_offering(contract_vehicle, offering):
    if offering.vehicle_type_id != contract_vehicle.vehicle_type_id:
        raise ServiceError(
            "Service is not available for this contract vehicle type",
            status=409,
        )


# Loads selected active options and validates that they belong to the offering.
def resolve_offering_option_links(offering, option_ids):
    if not option_ids:
        return []

    option_id_set = set(option_ids)
    links = list(
        ServiceOfferingOption.objects.select_related(
            "option",
            "service_offering__vehicle_type",
            "service_offering__vehicle_type__group",
        ).filter(
            service_offering=offering,
            option_id__in=option_id_set,
            is_active=True,
            option__is_active=True,
        )
    )
    if len(links) != len(option_id_set):
        raise ServiceError("One or more options are not available for this service offering", status=400)

    for link in links:
        validate_option_applicability(offering, link.option)

    link_by_option_id = {link.option_id: link for link in links}
    return [link_by_option_id[option_id] for option_id in option_ids]


# Applies the option's group/type guard on top of the explicit offering link.
def validate_option_applicability(offering, option):
    vehicle_type = offering.vehicle_type
    if option.applicable_group_id and option.applicable_group_id != vehicle_type.group_id:
        raise ServiceError("One or more options are not available for this vehicle group", status=400)
    if option.applicable_vehicle_type_id and option.applicable_vehicle_type_id != vehicle_type.id:
        raise ServiceError("One or more options are not available for this vehicle type", status=400)


# Finds the active default retail price list used by the public bot flow.
def get_default_retail_price_list():
    return (
        PriceList.objects.filter(
            kind=PriceList.Kind.RETAIL,
            is_default=True,
            is_active=True,
        )
        .order_by("id")
        .first()
    )


# Returns retail service price from pricing domain, with legacy catalog fallback.
def get_service_offering_price(offering, price_list):
    if price_list is None:
        return offering.price

    price_item = (
        ServiceOfferingPrice.objects.filter(
            price_list=price_list,
            service_offering=offering,
            is_active=True,
        )
        .only("price")
        .first()
    )
    return price_item.price if price_item else offering.price


# Returns retail option price from pricing domain, with legacy catalog fallback.
def get_service_option_price(option, price_list):
    if price_list is None:
        return option.price

    price_item = (
        ServiceOptionPrice.objects.filter(
            price_list=price_list,
            option=option,
            is_active=True,
        )
        .only("price")
        .first()
    )
    return price_item.price if price_item else option.price


# Builds effective option price/duration using a contract override when present.
def build_option_item(offering_option, contract, price_list=None):
    option = offering_option.option
    rule = find_option_rule(contract, option) if contract else None
    if rule and not rule.is_allowed:
        raise ServiceError(f"Option is not allowed by contract: {option.id}", status=403)

    price = get_service_option_price(option, price_list)
    duration = option.extra_duration_minutes
    if offering_option.price_override is not None:
        price = offering_option.price_override
    if offering_option.extra_duration_override is not None:
        duration = offering_option.extra_duration_override
    if rule:
        price = rule.custom_price if rule.custom_price is not None else price
        duration = (
            rule.custom_extra_duration_minutes
            if rule.custom_extra_duration_minutes is not None
            else duration
        )

    return {
        "id": option.id,
        "title": option.title,
        "price_decimal": price,
        "duration_minutes": duration,
    }


# Finds any contract vehicle for a normalized plate number.
def find_contract_vehicle(vehicle_number):
    if not vehicle_number:
        return None

    return (
        ContractVehicle.objects.select_related(
            "contract",
            "contract__company",
            "vehicle_type",
            "vehicle_type__group",
        )
        .filter(
            normalized_vehicle_number=vehicle_number,
        )
        .order_by("-is_active", "-contract__starts_on")
        .first()
    )


# Explains why a matched contract vehicle cannot be used for contract billing.
def get_contract_unavailable_reason(contract_vehicle):
    if contract_vehicle is None:
        return None

    contract = contract_vehicle.contract
    today = timezone.localdate()

    if not contract_vehicle.is_active:
        return "vehicle_inactive"
    if not contract.company.is_active:
        return "company_inactive"
    if contract.status != Contract.Status.ACTIVE:
        return "contract_not_active"
    if contract.starts_on > today:
        return "contract_not_started"
    if contract.ends_on is not None and contract.ends_on < today:
        return "contract_expired"

    return None


# Finds a contract override for the main service offering.
def find_service_rule(contract, offering):
    return ContractServiceRule.objects.filter(
        contract=contract,
        service_offering=offering,
    ).first()


# Finds a contract override for a selected option.
def find_option_rule(contract, option):
    return ContractOptionRule.objects.filter(
        contract=contract,
        option=option,
    ).first()

# Converts Decimal values to JSON-friendly numbers.
def decimal_to_number(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


# Serializes contract summary for the bot.
def serialize_contract(contract):
    return {
        "id": contract.id,
        "number": contract.number,
        "companyTitle": contract.company.title,
    }


# Serializes matched contract vehicle for the bot.
def serialize_contract_vehicle(contract_vehicle):
    return {
        "vehicleNumber": contract_vehicle.vehicle_number,
        "vehicleTypeId": contract_vehicle.vehicle_type_id,
        "vehicleGroupId": contract_vehicle.vehicle_type.group_id,
        "vehicleTypeTitle": contract_vehicle.vehicle_type.title,
        "title": contract_vehicle.title,
    }
