from django.contrib import admin

from .models import (
    Booking,
    BookingPostAllocation,
    Client,
    Service,
    ServiceOffering,
    ServiceOfferingOption,
    ServiceOption,
    ServicePost,
    VehicleGroup,
    VehicleType,
)


class ServiceOfferingOptionInline(admin.TabularInline):
    model = ServiceOfferingOption
    extra = 0
    autocomplete_fields = ("option",)
    fields = (
        "option",
        "is_active",
        "is_required",
        "price_override",
        "extra_duration_override",
        "sort_order",
    )


@admin.register(VehicleGroup)
class VehicleGroupAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "is_active")
    list_filter = ("is_active",)
    search_fields = ("id", "title")


@admin.register(VehicleType)
class VehicleTypeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "group",
        "is_active",
    )
    list_filter = ("group", "is_active")
    search_fields = ("id", "title")


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "is_active")
    list_filter = ("is_active",)
    search_fields = ("id", "title")


@admin.register(ServiceOffering)
class ServiceOfferingAdmin(admin.ModelAdmin):
    list_display = (
        "service",
        "vehicle_type",
        "price",
        "duration_minutes",
        "is_active",
    )
    list_filter = ("is_active", "service", "vehicle_type__group", "vehicle_type")
    search_fields = ("service__title", "vehicle_type__title", "vehicle_type__id")
    inlines = (ServiceOfferingOptionInline,)


@admin.register(ServiceOfferingOption)
class ServiceOfferingOptionAdmin(admin.ModelAdmin):
    list_display = (
        "service_offering",
        "option",
        "is_active",
        "is_required",
        "price_override",
        "extra_duration_override",
        "sort_order",
    )
    list_filter = (
        "is_active",
        "is_required",
        "service_offering__service",
        "service_offering__vehicle_type__group",
        "service_offering__vehicle_type",
    )
    search_fields = (
        "service_offering__service__title",
        "service_offering__vehicle_type__title",
        "option__title",
        "option__id",
    )
    autocomplete_fields = ("service_offering", "option")


@admin.register(ServiceOption)
class ServiceOptionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "price",
        "extra_duration_minutes",
        "applicable_group",
        "applicable_vehicle_type",
        "select_mode",
        "is_active",
    )
    list_filter = (
        "is_active",
        "select_mode",
        "applicable_group",
        "applicable_vehicle_type",
    )
    search_fields = ("id", "title")


@admin.register(ServicePost)
class ServicePostAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "location", "sort_order", "is_active")
    list_filter = ("location", "is_active", "supported_services", "supported_options")
    search_fields = ("id", "title")
    filter_horizontal = ("supported_services", "supported_options")


class BookingPostAllocationInline(admin.TabularInline):
    model = BookingPostAllocation
    extra = 0
    readonly_fields = ("starts_at", "ends_at", "service_post", "service", "service_option", "sort_order")
    can_delete = False


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "phone",
        "username",
        "telegram_user_id",
        "last_seen_at",
    )
    search_fields = ("full_name", "phone", "username", "telegram_user_id")
    readonly_fields = ("created_at",)


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "starts_at",
        "ends_at",
        "client",
        "service_post",
        "vehicle_number",
        "normalized_vehicle_number",
        "service_offering",
        "status",
        "total_price",
    )
    list_filter = (
        "status",
        "client_type",
        "service_post",
        "service_offering__service",
        "service_offering__vehicle_type",
    )
    search_fields = (
        "external_id",
        "client__full_name",
        "client__phone",
        "vehicle_number",
        "normalized_vehicle_number",
    )
    filter_horizontal = ("options",)
    readonly_fields = ("created_at", "updated_at")
    inlines = (BookingPostAllocationInline,)


@admin.register(BookingPostAllocation)
class BookingPostAllocationAdmin(admin.ModelAdmin):
    list_display = (
        "starts_at",
        "ends_at",
        "service_post",
        "booking",
        "service",
        "service_option",
    )
    list_filter = ("service_post", "service", "service_option")
    search_fields = ("booking__external_id", "booking__vehicle_number")
