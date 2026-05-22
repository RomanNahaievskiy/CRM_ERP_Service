from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from booking.models import (
    Service,
    ServiceOffering,
    ServiceOfferingOption,
    ServiceOption,
    VehicleGroup,
    VehicleType,
)
from booking.services.errors import ServiceError
from contracts.models import Company, Contract, ContractVehicle
from pricing.services import resolve_pricing_terms


class ContractVehiclePricingTests(TestCase):
    def setUp(self):
        passenger_group = VehicleGroup.objects.create(
            id="pricing_test_passenger",
            title="Passenger",
        )
        tanker_group = VehicleGroup.objects.create(
            id="pricing_test_tanker",
            title="Tanker",
        )
        self.bus_type = VehicleType.objects.create(
            id="pricing_test_bus_30",
            group=passenger_group,
            title="Passenger bus",
        )
        self.tanker_type = VehicleType.objects.create(
            id="pricing_test_tank_trailer",
            group=tanker_group,
            title="Tank trailer",
        )
        self.wash = Service.objects.create(
            id="pricing_test_interior_tank_wash",
            title="Interior tank wash",
        )
        self.basic_wash = Service.objects.create(
            id="pricing_test_basic_wash",
            title="Basic wash",
        )
        self.tanker_offering = ServiceOffering.objects.create(
            service=self.wash,
            vehicle_type=self.tanker_type,
            price=Decimal("1500.00"),
            duration_minutes=60,
        )
        self.bus_offering = ServiceOffering.objects.create(
            service=self.basic_wash,
            vehicle_type=self.bus_type,
            price=Decimal("900.00"),
            duration_minutes=30,
        )
        self.interior_option = ServiceOption.objects.create(
            id="pricing_test_interior",
            title="Interior cleaning",
            price=Decimal("250.00"),
            extra_duration_minutes=20,
            applicable_group=passenger_group,
        )

        company = Company.objects.create(title="KLR Demo")
        contract = Contract.objects.create(
            company=company,
            number="KLR-2026",
            status=Contract.Status.ACTIVE,
            starts_on=timezone.localdate(),
        )
        self.contract_vehicle = ContractVehicle.objects.create(
            contract=contract,
            vehicle_number="AA1234KL",
            vehicle_type=self.bus_type,
        )

    def test_contract_vehicle_cannot_use_offering_for_another_vehicle_type(self):
        with self.assertRaisesMessage(
            ServiceError,
            "Service is not available for this contract vehicle type",
        ):
            resolve_pricing_terms(
                {
                    "serviceOfferingId": "pricing_test_interior_tank_wash__pricing_test_tank_trailer",
                    "vehicleNumber": "AA1234KL",
                    "billingMode": "auto",
                    "optionIds": [],
                }
            )

    def test_unavailable_service_for_contract_vehicle_returns_stop_reason(self):
        summary = resolve_pricing_terms(
            {
                "serviceId": "pricing_test_interior_tank_wash",
                "vehicleNumber": "AA1234KL",
                "billingMode": "auto",
                "optionIds": [],
            }
        )

        self.assertFalse(summary["contractFound"])
        self.assertTrue(summary["contractMatched"])
        self.assertEqual(
            summary["contractUnavailableReason"],
            "service_offering_not_found",
        )
        self.assertEqual(summary["vehicle"]["vehicleTypeId"], "pricing_test_bus_30")

    def test_selected_option_must_be_linked_to_service_offering(self):
        with self.assertRaisesMessage(
            ServiceError,
            "One or more options are not available for this service offering",
        ):
            resolve_pricing_terms(
                {
                    "serviceOfferingId": "pricing_test_basic_wash__pricing_test_bus_30",
                    "vehicleNumber": "BC1234AA",
                    "billingMode": "retail",
                    "optionIds": ["pricing_test_interior"],
                }
            )

    def test_linked_option_uses_offering_overrides(self):
        ServiceOfferingOption.objects.create(
            service_offering=self.bus_offering,
            option=self.interior_option,
            price_override=Decimal("180.00"),
            extra_duration_override=15,
        )

        summary = resolve_pricing_terms(
            {
                "serviceOfferingId": "pricing_test_basic_wash__pricing_test_bus_30",
                "vehicleNumber": "BC1234AA",
                "billingMode": "retail",
                "optionIds": ["pricing_test_interior"],
            }
        )

        self.assertEqual(summary["optionItems"][0]["price"], 180.0)
        self.assertEqual(summary["optionItems"][0]["extraDurationMinutes"], 15)
        self.assertEqual(summary["totalPrice"], 1080.0)
        self.assertEqual(summary["totalDurationMinutes"], 45)
