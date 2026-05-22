from django.contrib import admin

from .models import (
    BusinessHours,
    BusinessSettings,
    Location,
    OperatorContact,
    ServicePostHours,
    WorkBreak,
)


class BusinessHoursInline(admin.TabularInline):
    model = BusinessHours
    extra = 0


class WorkBreakInline(admin.TabularInline):
    model = WorkBreak
    extra = 0


class OperatorContactInline(admin.TabularInline):
    model = OperatorContact
    extra = 0


@admin.register(BusinessSettings)
class BusinessSettingsAdmin(admin.ModelAdmin):
    list_display = ("title", "slot_step_minutes", "booking_days_ahead", "is_active")
    list_filter = ("is_active",)


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "address", "is_default", "is_active")
    list_filter = ("is_default", "is_active")
    search_fields = ("id", "title", "address")
    inlines = (BusinessHoursInline, WorkBreakInline, OperatorContactInline)


@admin.register(BusinessHours)
class BusinessHoursAdmin(admin.ModelAdmin):
    list_display = ("location", "weekday", "opens_at", "closes_at", "is_active")
    list_filter = ("location", "weekday", "is_active")


@admin.register(WorkBreak)
class WorkBreakAdmin(admin.ModelAdmin):
    list_display = (
        "location",
        "service_post",
        "weekday",
        "title",
        "starts_at",
        "ends_at",
        "is_active",
    )
    list_filter = ("location", "service_post", "weekday", "is_active")


@admin.register(ServicePostHours)
class ServicePostHoursAdmin(admin.ModelAdmin):
    list_display = ("service_post", "weekday", "opens_at", "closes_at", "is_active")
    list_filter = ("service_post", "weekday", "is_active")


@admin.register(OperatorContact)
class OperatorContactAdmin(admin.ModelAdmin):
    list_display = ("title", "phone", "telegram_username", "location", "is_primary", "is_active")
    list_filter = ("location", "is_primary", "is_active")
    search_fields = ("title", "phone", "telegram_username")
