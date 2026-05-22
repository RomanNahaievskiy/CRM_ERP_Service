from django.contrib import admin

from .models import BookingReminder, ReminderSetting


@admin.register(ReminderSetting)
class ReminderSettingAdmin(admin.ModelAdmin):
    list_display = ("title", "offset_minutes", "sort_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("title",)


@admin.register(BookingReminder)
class BookingReminderAdmin(admin.ModelAdmin):
    list_display = (
        "scheduled_at",
        "booking",
        "offset_minutes",
        "status",
        "attempts",
        "sent_at",
    )
    list_filter = ("status", "setting")
    search_fields = (
        "booking__external_id",
        "booking__vehicle_number",
        "booking__client__full_name",
        "booking__client__phone",
    )
    readonly_fields = (
        "booking",
        "setting",
        "offset_minutes",
        "scheduled_at",
        "attempts",
        "last_error",
        "sent_at",
        "claimed_at",
        "created_at",
        "updated_at",
    )

