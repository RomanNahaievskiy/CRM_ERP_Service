from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from booking.models import Booking, Client, Service, ServiceOffering, ServicePost, VehicleGroup, VehicleType
from operations.models import Location, OperatorContact
from reminders.models import BookingReminder, ReminderSetting
from reminders.services import claim_due_reminders, schedule_reminders_for_booking
from reminders.views import serialize_reminder


class ReminderSchedulingTest(TestCase):
    def setUp(self):
        group = VehicleGroup.objects.create(id="reminder_test_group", title="Passenger")
        vehicle_type = VehicleType.objects.create(
            id="reminder_test_vehicle",
            group=group,
            title="Microbus",
        )
        service = Service.objects.create(id="reminder_test_wash", title="Wash")
        self.offering = ServiceOffering.objects.create(
            service=service,
            vehicle_type=vehicle_type,
            price=Decimal("500.00"),
            duration_minutes=30,
        )
        self.client = Client.objects.create(
            telegram_user_id=123,
            telegram_chat_id=456,
            full_name="Test Client",
        )
        self.location = Location.objects.create(
            id="reminder_test_location",
            title="Test Location",
            address="Kyiv demo service yard",
            latitude=50.450100,
            longitude=30.523400,
        )
        self.service_post = ServicePost.objects.create(
            id="reminder_test_post",
            location=self.location,
            title="Post 1",
        )

    def create_booking(self, starts_at):
        return Booking.objects.create(
            external_id=f"TEST-{starts_at.timestamp()}",
            client=self.client,
            service_offering=self.offering,
            service_post=self.service_post,
            vehicle_number="AA1234AA",
            starts_at=starts_at,
            ends_at=starts_at + timezone.timedelta(minutes=30),
            status=Booking.Status.NEW,
            total_price=Decimal("500.00"),
            total_duration_minutes=30,
        )

    def test_schedule_reminders_skips_offsets_that_are_already_in_the_past(self):
        booking = self.create_booking(timezone.now() + timezone.timedelta(hours=4))

        reminders = schedule_reminders_for_booking(booking)

        self.assertEqual(
            [reminder.offset_minutes for reminder in reminders],
            [120, 15],
        )
        self.assertFalse(
            BookingReminder.objects.filter(
                booking=booking,
                offset_minutes=1440,
            ).exists()
        )

    def test_claim_due_reminders_does_not_send_stale_reminders_created_after_schedule_time(self):
        now = timezone.now()
        booking = self.create_booking(now + timezone.timedelta(hours=4))
        setting = ReminderSetting.objects.get(offset_minutes=1440)
        BookingReminder.objects.create(
            booking=booking,
            setting=setting,
            offset_minutes=setting.offset_minutes,
            scheduled_at=now - timezone.timedelta(minutes=1),
        )

        reminders = claim_due_reminders()

        self.assertEqual(reminders, [])
        self.assertEqual(
            BookingReminder.objects.get(booking=booking, setting=setting).status,
            BookingReminder.Status.PENDING,
        )

    def test_serialized_reminder_includes_action_data_for_buttons(self):
        OperatorContact.objects.create(
            location=self.location,
            title="Operator",
            phone="+380501112233",
            telegram_username="washbot_operator",
            is_primary=True,
        )
        booking = self.create_booking(timezone.now() + timezone.timedelta(hours=4))
        setting = ReminderSetting.objects.get(offset_minutes=120)
        reminder = BookingReminder.objects.create(
            booking=booking,
            setting=setting,
            offset_minutes=setting.offset_minutes,
            scheduled_at=booking.starts_at - timezone.timedelta(minutes=setting.offset_minutes),
        )

        payload = serialize_reminder(reminder)

        self.assertEqual(payload["booking"]["location"]["latitude"], 50.4501)
        self.assertEqual(payload["booking"]["location"]["longitude"], 30.5234)
        self.assertEqual(payload["booking"]["operator"]["telegramUsername"], "washbot_operator")
