from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from booking.models import (
    Booking,
    BookingPostAllocation,
    Client,
    ServiceOffering,
    ServiceOfferingOption,
    ServiceOption,
    ServicePost,
    VehicleType,
)
from booking.services.allocation import build_booking_stages, create_allocations, find_allocation_plan
from common.normalization import normalize_vehicle_number
from contracts.models import (
    Company,
    Contract,
    ContractOptionRule,
    ContractServiceRule,
    ContractVehicle,
)
from operations.models import (
    BusinessSettings,
    Location,
    OperatorContact,
    ServicePostHours,
    WorkBreak,
)
from pricing.models import PriceList, ServiceOfferingPrice, ServiceOptionPrice


class Command(BaseCommand):
    help = "Seed demo data for local development and manual testing."

    def handle(self, *args, **options):
        with transaction.atomic():
            location = self.seed_operations()
            self.seed_service_offering_options()
            price_list = self.seed_pricing()
            company, contract = self.seed_contracts()
            self.seed_demo_bookings(contract)

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))
        self.stdout.write(f"Location: {location.id}")
        self.stdout.write(f"Price list: {price_list.code}")
        self.stdout.write(f"Company: {company.title}")
        self.stdout.write(f"Contract: {contract.number}")

    # Creates operational data that helps test location/post scheduling.
    def seed_operations(self):
        settings, _ = BusinessSettings.objects.update_or_create(
            title="Default settings",
            defaults={
                "slot_step_minutes": 15,
                "booking_days_ahead": 14,
                "is_active": True,
            },
        )
        BusinessSettings.objects.exclude(id=settings.id).update(is_active=False)

        location, _ = Location.objects.update_or_create(
            id="main",
            defaults={
                "title": "Main wash location",
                "address": "Kyiv demo service yard",
                "latitude": Decimal("50.450001"),
                "longitude": Decimal("30.523333"),
                "is_default": True,
                "is_active": True,
            },
        )

        OperatorContact.objects.update_or_create(
            title="Main operator",
            phone="+380501112233",
            defaults={
                "location": location,
                "telegram_username": "washbot_operator",
                "is_primary": True,
                "is_active": True,
            },
        )

        WorkBreak.objects.update_or_create(
            location=location,
            service_post=None,
            weekday=0,
            starts_at=time(hour=13),
            ends_at=time(hour=13, minute=30),
            defaults={
                "title": "Monday lunch break",
                "is_active": True,
            },
        )

        cleanup_box = ServicePost.objects.filter(id="cleenup_box").first()
        if cleanup_box:
            ServicePostHours.objects.update_or_create(
                service_post=cleanup_box,
                weekday=0,
                opens_at=time(hour=9),
                closes_at=time(hour=18),
                defaults={"is_active": True},
            )

        return location

    # Links compatible extra options to each offering so admins can disable them per offering.
    def seed_service_offering_options(self):
        options = list(ServiceOption.objects.filter(is_active=True).order_by("title", "id"))
        offerings = ServiceOffering.objects.select_related(
            "vehicle_type",
            "vehicle_type__group",
        ).filter(
            is_active=True,
            service__is_active=True,
            vehicle_type__is_active=True,
            vehicle_type__group__is_active=True,
        )

        for offering in offerings:
            sort_order = 0
            for option in options:
                group_ok = (
                    not option.applicable_group_id
                    or option.applicable_group_id == offering.vehicle_type.group_id
                )
                vehicle_ok = (
                    not option.applicable_vehicle_type_id
                    or option.applicable_vehicle_type_id == offering.vehicle_type_id
                )
                if not group_ok or not vehicle_ok:
                    continue

                link, created = ServiceOfferingOption.objects.get_or_create(
                    service_offering=offering,
                    option=option,
                    defaults={
                        "is_active": True,
                        "sort_order": sort_order,
                    },
                )
                if not created and link.sort_order != sort_order:
                    link.sort_order = sort_order
                    link.save(update_fields=["sort_order"])
                sort_order += 10

    # Creates the default retail price list from current catalog prices.
    def seed_pricing(self):
        price_list, _ = PriceList.objects.update_or_create(
            code="retail-default",
            defaults={
                "title": "Default retail price list",
                "kind": PriceList.Kind.RETAIL,
                "currency": "UAH",
                "is_default": True,
                "is_active": True,
                "notes": "Seeded from legacy catalog prices.",
            },
        )
        PriceList.objects.filter(
            kind=PriceList.Kind.RETAIL,
            is_default=True,
        ).exclude(id=price_list.id).update(is_default=False)

        for offering in ServiceOffering.objects.all():
            ServiceOfferingPrice.objects.update_or_create(
                price_list=price_list,
                service_offering=offering,
                defaults={
                    "price": offering.price,
                    "is_active": True,
                },
            )

        for option in ServiceOption.objects.all():
            ServiceOptionPrice.objects.update_or_create(
                price_list=price_list,
                option=option,
                defaults={
                    "price": option.price,
                    "is_active": True,
                },
            )

        return price_list

    # Creates a B2B company, active contract, vehicles, and commercial overrides.
    def seed_contracts(self):
        company, _ = Company.objects.update_or_create(
            title="KLR Logistics Demo",
            defaults={
                "legal_name": "KLR Logistics Demo LLC",
                "tax_id": "DEMO-EDRPOU-001",
                "contact_person": "Olena Dispatcher",
                "phone": "+380671112233",
                "email": "ops.demo@example.com",
                "is_active": True,
                "notes": "Demo B2B customer for contract booking tests.",
            },
        )

        contract, _ = Contract.objects.update_or_create(
            company=company,
            number="KLR-DEMO-2026",
            defaults={
                "title": "Demo fleet wash contract",
                "status": Contract.Status.ACTIVE,
                "starts_on": date(2026, 1, 1),
                "ends_on": date(2026, 12, 31),
                "payment_terms": "Monthly invoice",
                "notes": "Contains custom prices and durations for demo vehicles.",
            },
        )

        self.seed_contract_vehicles(contract)
        self.seed_contract_rules(contract)

        return company, contract

    # Adds vehicles that should be recognized as contract-covered fleet units.
    def seed_contract_vehicles(self, contract):
        vehicles = [
            ("AA1234KL", "bus_double", "Double decker demo bus"),
            ("KA7777TR", "truck_10t", "10t demo truck"),
        ]

        for vehicle_number, vehicle_type_id, title in vehicles:
            vehicle_type = VehicleType.objects.get(id=vehicle_type_id)
            ContractVehicle.objects.update_or_create(
                contract=contract,
                normalized_vehicle_number=normalize_vehicle_number(vehicle_number),
                defaults={
                    "vehicle_number": vehicle_number,
                    "vehicle_type": vehicle_type,
                    "title": title,
                    "is_active": True,
                },
            )

    # Adds contract-specific prices and durations for selected services/options.
    def seed_contract_rules(self, contract):
        rules = [
            ("wash", "bus_double", Decimal("950.00"), 18),
            ("wash", "truck_10t", Decimal("1000.00"), 18),
        ]

        for service_id, vehicle_type_id, price, duration in rules:
            offering = ServiceOffering.objects.get(
                service_id=service_id,
                vehicle_type_id=vehicle_type_id,
            )
            ContractServiceRule.objects.update_or_create(
                contract=contract,
                service_offering=offering,
                defaults={
                    "custom_price": price,
                    "custom_duration_minutes": duration,
                    "is_allowed": True,
                    "notes": "Demo contract override.",
                },
            )

        option_rules = [
            ("undercarriage", Decimal("200.00"), 0),
            ("engine_double_bus", Decimal("350.00"), 8),
            ("interior_double_bus", Decimal("250.00"), 20),
        ]

        for option_id, price, duration in option_rules:
            option = ServiceOption.objects.get(id=option_id)
            ContractOptionRule.objects.update_or_create(
                contract=contract,
                option=option,
                defaults={
                    "custom_price": price,
                    "custom_extra_duration_minutes": duration,
                    "is_allowed": True,
                    "notes": "Demo contract option override.",
                },
            )

    # Creates a couple of bookings so the future admin panel has data to show.
    def seed_demo_bookings(self, contract):
        now = timezone.localtime()
        first_day = now.date() + timedelta(days=1)

        retail_client, _ = Client.objects.update_or_create(
            phone="+380631234567",
            defaults={
                "full_name": "Retail Demo Client",
                "first_seen_at": timezone.now(),
                "last_seen_at": timezone.now(),
            },
        )
        self.upsert_demo_booking(
            external_id="demo-retail-001",
            client=retail_client,
            client_type=Booking.ClientType.RETAIL,
            vehicle_number="BC1234AA",
            service_id="wash",
            vehicle_type_id="micro_18",
            option_ids=["undercarriage"],
            starts_at=self.aware_at(first_day, 10, 0),
            comment="Demo retail booking.",
        )

        contract_client, _ = Client.objects.update_or_create(
            phone="+380671112233",
            defaults={
                "full_name": f"{contract.company.title} Dispatcher",
                "first_seen_at": timezone.now(),
                "last_seen_at": timezone.now(),
            },
        )
        self.upsert_demo_booking(
            external_id="demo-contract-001",
            client=contract_client,
            client_type=Booking.ClientType.CONTRACT,
            vehicle_number="AA1234KL",
            service_id="wash",
            vehicle_type_id="bus_double",
            option_ids=["engine_double_bus", "interior_double_bus"],
            starts_at=self.aware_at(first_day, 11, 0),
            comment=f"Demo contract booking for {contract.number}.",
        )

    # Updates or creates one demo booking and rebuilds its post allocations.
    def upsert_demo_booking(
        self,
        external_id,
        client,
        client_type,
        vehicle_number,
        service_id,
        vehicle_type_id,
        option_ids,
        starts_at,
        comment,
    ):
        offering = ServiceOffering.objects.get(
            service_id=service_id,
            vehicle_type_id=vehicle_type_id,
        )
        options = list(ServiceOption.objects.filter(id__in=option_ids))
        total_duration = offering.duration_minutes + sum(
            option.extra_duration_minutes for option in options
        )
        ends_at = starts_at + timedelta(minutes=total_duration)
        existing_booking = Booking.objects.filter(external_id=external_id).first()
        if existing_booking:
            BookingPostAllocation.objects.filter(booking=existing_booking).delete()

        stages = build_booking_stages(offering, options, starts_at)
        allocation_plan = find_allocation_plan(stages, lock=True)

        if allocation_plan is None:
            self.stdout.write(
                self.style.WARNING(
                    f"Skipped booking {external_id}: no available allocation plan."
                )
            )
            return

        booking, _ = Booking.objects.update_or_create(
            external_id=external_id,
            defaults={
                "client": client,
                "service_offering": offering,
                "service_post": allocation_plan[0]["service_post"],
                "vehicle_number": vehicle_number,
                "starts_at": starts_at,
                "ends_at": ends_at,
                "status": Booking.Status.CONFIRMED,
                "client_type": client_type,
                "total_price": offering.price + sum(option.price for option in options),
                "total_duration_minutes": total_duration,
                "comment": comment,
                "admin": "seed_demo_data",
            },
        )
        booking.options.set(options)
        BookingPostAllocation.objects.filter(booking=booking).delete()
        create_allocations(booking, allocation_plan)

    # Creates a timezone-aware datetime for local demo dates.
    def aware_at(self, date_value, hour, minute):
        naive = datetime.combine(date_value, time(hour=hour, minute=minute))
        return timezone.make_aware(naive, timezone.get_current_timezone())
