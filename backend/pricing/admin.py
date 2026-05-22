from django.contrib import admin

from .models import PriceList, ServiceOfferingPrice, ServiceOptionPrice


class ServiceOfferingPriceInline(admin.TabularInline):
    model = ServiceOfferingPrice
    extra = 0


class ServiceOptionPriceInline(admin.TabularInline):
    model = ServiceOptionPrice
    extra = 0


@admin.register(PriceList)
class PriceListAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "kind", "currency", "is_default", "is_active")
    list_filter = ("kind", "currency", "is_default", "is_active")
    search_fields = ("code", "title", "notes")
    readonly_fields = ("created_at", "updated_at")
    inlines = (ServiceOfferingPriceInline, ServiceOptionPriceInline)


@admin.register(ServiceOfferingPrice)
class ServiceOfferingPriceAdmin(admin.ModelAdmin):
    list_display = ("price_list", "service_offering", "price", "is_active")
    list_filter = (
        "price_list",
        "is_active",
        "service_offering__service",
        "service_offering__vehicle_type__group",
    )
    search_fields = (
        "price_list__title",
        "price_list__code",
        "service_offering__service__title",
        "service_offering__vehicle_type__title",
    )


@admin.register(ServiceOptionPrice)
class ServiceOptionPriceAdmin(admin.ModelAdmin):
    list_display = ("price_list", "option", "price", "is_active")
    list_filter = ("price_list", "is_active", "option")
    search_fields = ("price_list__title", "price_list__code", "option__title")
