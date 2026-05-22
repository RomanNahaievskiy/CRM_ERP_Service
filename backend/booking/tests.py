from decimal import Decimal
import json
from datetime import time
from unittest.mock import patch

from django.test import Client as DjangoClient, TestCase
from django.test import override_settings
from django.utils import timezone

from booking.models import (
    Booking,
    BookingPostAllocation,
    Client,
    Service,
    ServiceOffering,
    ServicePost,
    VehicleGroup,
    VehicleType,
)
from operations.models import BusinessHours, Location


class BookingTableConsoleTest(TestCase):
    def test_print_booking_table(self):
        group, _ = VehicleGroup.objects.update_or_create(
            id="passenger",
            defaults={"title": "Passenger", "is_active": True},
        )
        vehicle_type, _ = VehicleType.objects.update_or_create(
            id="bus_30",
            defaults={
                "group": group,
                "title": "Автобус до 30 місць",
                "is_active": True,
            },
        )
        service, _ = Service.objects.update_or_create(
            id="wash",
            defaults={"title": "Мийка", "is_active": True},
        )
        offering = ServiceOffering.objects.create(
            service=service,
            vehicle_type=vehicle_type,
            price=Decimal("900.00"),
            duration_minutes=15,
        )
        client = Client.objects.create(
            phone="+380501112233",
            full_name="Test Client",
        )

        Booking.objects.create(
            external_id="TEST-001",
            client=client,
            service_offering=offering,
            vehicle_number="AA1234KL",
            starts_at=timezone.now(),
            ends_at=timezone.now() + timezone.timedelta(minutes=15),
            status=Booking.Status.NEW,
            total_price=Decimal("900.00"),
            total_duration_minutes=15,
        )

        bookings = Booking.objects.select_related(
            "client",
            "service_offering__service",
            "service_offering__vehicle_type",
        ).order_by("id")

        print()
        print("ID | external_id | vehicle_number | service | vehicle_type | starts_at | status | total_price")
        print("-" * 100)
        for booking in bookings:
            print(
                f"{booking.id} | "
                f"{booking.external_id} | "
                f"{booking.vehicle_number} | "
                f"{booking.service_offering.service.title} | "
                f"{booking.service_offering.vehicle_type.title} | "
                f"{booking.starts_at:%Y-%m-%d %H:%M} | "
                f"{booking.status} | "
                f"{booking.total_price}"
            )

        self.assertEqual(bookings.count(), 1)


class BookingApiTest(TestCase):
    def setUp(self):
        group, _ = VehicleGroup.objects.update_or_create(
            id="passenger",
            defaults={
                "title": "Passenger",
                "is_active": True,
            },
        )
        vehicle_type, _ = VehicleType.objects.update_or_create(
            id="bus_30",
            defaults={
                "group": group,
                "title": "Автобус до 30 місць",
                "is_active": True,
            },
        )
        service, _ = Service.objects.update_or_create(
            id="wash",
            defaults={
                "title": "Мийка",
                "is_active": True,
            },
        )
        self.offering, _ = ServiceOffering.objects.update_or_create(
            service=service,
            vehicle_type=vehicle_type,
            defaults={
                "price": Decimal("900.00"),
                "duration_minutes": 15,
                "is_active": True,
            },
        )
        self.client_record = Client.objects.create(
            phone="+380501112233",
            full_name="Test Client",
        )
        self.location = Location.objects.create(
            id="test-location",
            title="Test Location",
            is_default=True,
            is_active=True,
        )
        self.service_post = ServicePost.objects.create(
            id="test-post",
            location=self.location,
            title="Test Post",
            is_active=True,
        )
        self.service_post.supported_services.add(service)
        self.http = DjangoClient()

    def test_bookings_endpoint_lists_bookings_for_admin_panel(self):
        booking = Booking.objects.create(
            external_id="TEST-API-001",
            client=self.client_record,
            service_offering=self.offering,
            service_post=self.service_post,
            vehicle_number="AA1234KL",
            starts_at=timezone.now(),
            ends_at=timezone.now() + timezone.timedelta(minutes=15),
            status=Booking.Status.NEW,
            client_type=Booking.ClientType.CONTRACT,
            total_price=Decimal("900.00"),
            total_duration_minutes=15,
            comment="Needs careful wash",
            admin="Olena",
        )
        BookingPostAllocation.objects.create(
            booking=booking,
            service_post=self.service_post,
            service=self.offering.service,
            starts_at=booking.starts_at,
            ends_at=booking.ends_at,
            sort_order=0,
        )

        response = self.http.get("/api/bookings/")

        self.assertEqual(response.status_code, 200)
        booking = response.json()["bookings"][0]
        self.assertEqual(booking["externalId"], "TEST-API-001")
        self.assertEqual(booking["clientType"], "contract")
        self.assertEqual(booking["postId"], "test-post")
        self.assertEqual(booking["postTitle"], "Test Post")
        self.assertEqual(booking["comment"], "Needs careful wash")
        self.assertEqual(booking["admin"], "Olena")
        self.assertEqual(len(booking["allocations"]), 1)
        self.assertEqual(booking["allocations"][0]["postId"], "test-post")
        self.assertEqual(booking["allocations"][0]["serviceTitle"], self.offering.service.title)

    def test_bookings_endpoint_still_routes_post_to_bot_creation_view(self):
        response = self.http.post(
            "/api/bookings/",
            data="{",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Invalid JSON body")

    @override_settings(TELEGRAM_BOT_TOKEN="test-token")
    def test_client_message_endpoint_sends_message_to_telegram_chat(self):
        self.client_record.telegram_chat_id = 987654
        self.client_record.save(update_fields=["telegram_chat_id"])

        class TelegramResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, traceback):
                return False

            def read(self):
                return b'{"ok": true, "result": {"message_id": 42}}'

        with patch("booking.services.client_messages.request.urlopen", return_value=TelegramResponse()) as urlopen:
            response = self.http.post(
                f"/api/clients/{self.client_record.id}/messages/",
                data=json.dumps({"text": "Hello from admin"}),
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["client"]["id"], self.client_record.id)
        self.assertEqual(payload["message"]["telegramMessageId"], 42)

        telegram_request = urlopen.call_args.args[0]
        self.assertEqual(telegram_request.full_url, "https://api.telegram.org/bottest-token/sendMessage")
        self.assertEqual(
            json.loads(telegram_request.data.decode("utf-8")),
            {"chat_id": 987654, "text": "Hello from admin"},
        )

    def test_client_message_endpoint_requires_telegram_chat(self):
        response = self.http.post(
            f"/api/clients/{self.client_record.id}/messages/",
            data=json.dumps({"text": "Hello from admin"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Client does not have a Telegram chat")

    def test_booking_create_is_idempotent_for_same_request_key(self):
        starts_at = timezone.now().replace(hour=10, minute=0, second=0, microsecond=0)
        if starts_at <= timezone.now():
            starts_at += timezone.timedelta(days=1)
        ends_at = starts_at + timezone.timedelta(minutes=15)
        BusinessHours.objects.create(
            location=self.location,
            weekday=timezone.localtime(starts_at).weekday(),
            opens_at=time(8, 0),
            closes_at=time(20, 0),
            is_active=True,
        )
        payload = {
            "idempotencyKey": "booking-test-001",
            "telegramUserId": 12345,
            "telegramChatId": 12345,
            "phone": "+380501112233",
            "serviceOfferingId": "wash__bus_30",
            "optionIds": [],
            "billingMode": "retail",
            "startsAt": starts_at.isoformat(),
            "endsAt": ends_at.isoformat(),
            "totalPrice": 900,
            "totalDurationMinutes": 15,
        }

        first_response = self.http.post(
            "/api/bookings/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        second_response = self.http.post(
            "/api/bookings/",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 201)
        self.assertEqual(first_response.json()["id"], "bot-booking-test-001")
        self.assertEqual(second_response.json()["id"], "bot-booking-test-001")
        self.assertEqual(Booking.objects.filter(external_id="bot-booking-test-001").count(), 1)

    def test_admin_booking_create_can_pin_first_stage_to_selected_post(self):
        starts_at = timezone.now().replace(hour=10, minute=0, second=0, microsecond=0)
        if starts_at <= timezone.now():
            starts_at += timezone.timedelta(days=1)
        ends_at = starts_at + timezone.timedelta(minutes=15)
        BusinessHours.objects.create(
            location=self.location,
            weekday=timezone.localtime(starts_at).weekday(),
            opens_at=time(8, 0),
            closes_at=time(20, 0),
            is_active=True,
        )
        admin_post = ServicePost.objects.create(
            id="admin-selected-post",
            location=self.location,
            title="Admin Selected Post",
            sort_order=99,
            is_active=True,
        )
        admin_post.supported_services.add(self.offering.service)
        payload = {
            "idempotencyKey": "admin-post-test-001",
            "phone": "+380501112233",
            "serviceOfferingId": "wash__bus_30",
            "optionIds": [],
            "billingMode": "retail",
            "startsAt": starts_at.isoformat(),
            "endsAt": ends_at.isoformat(),
            "firstStagePostId": admin_post.id,
        }

        response = self.http.post(
            "/api/bookings/",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        booking = Booking.objects.get(external_id="bot-admin-post-test-001")
        allocation = booking.post_allocations.get(sort_order=0)
        self.assertEqual(booking.service_post_id, admin_post.id)
        self.assertEqual(allocation.service_post_id, admin_post.id)

    def test_admin_booking_create_does_not_fallback_when_selected_post_is_busy(self):
        starts_at = timezone.now().replace(hour=10, minute=0, second=0, microsecond=0)
        if starts_at <= timezone.now():
            starts_at += timezone.timedelta(days=1)
        ends_at = starts_at + timezone.timedelta(minutes=15)
        BusinessHours.objects.create(
            location=self.location,
            weekday=timezone.localtime(starts_at).weekday(),
            opens_at=time(8, 0),
            closes_at=time(20, 0),
            is_active=True,
        )
        free_post = ServicePost.objects.create(
            id="free-post",
            location=self.location,
            title="Free Post",
            sort_order=99,
            is_active=True,
        )
        free_post.supported_services.add(self.offering.service)
        blocking_booking = Booking.objects.create(
            external_id="BLOCKING-POST-001",
            client=self.client_record,
            service_offering=self.offering,
            service_post=self.service_post,
            starts_at=starts_at,
            ends_at=ends_at,
            status=Booking.Status.NEW,
            total_duration_minutes=15,
        )
        BookingPostAllocation.objects.create(
            booking=blocking_booking,
            service_post=self.service_post,
            service=self.offering.service,
            starts_at=starts_at,
            ends_at=ends_at,
            sort_order=0,
        )
        payload = {
            "idempotencyKey": "admin-post-test-002",
            "phone": "+380501112233",
            "serviceOfferingId": "wash__bus_30",
            "optionIds": [],
            "billingMode": "retail",
            "startsAt": starts_at.isoformat(),
            "endsAt": ends_at.isoformat(),
            "firstStagePostId": self.service_post.id,
        }

        response = self.http.post(
            "/api/bookings/",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json()["error"],
            "No available service post route for this time and option set",
        )
        self.assertFalse(Booking.objects.filter(external_id="bot-admin-post-test-002").exists())
