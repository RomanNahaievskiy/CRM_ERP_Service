from django.contrib import admin

from .models import (
    Company,
    Contract,
    ContractOptionRule,
    ContractServiceRule,
    ContractVehicle,
)


class ContractVehicleInline(admin.TabularInline):
    model = ContractVehicle
    extra = 0


class ContractServiceRuleInline(admin.TabularInline):
    model = ContractServiceRule
    extra = 0


class ContractOptionRuleInline(admin.TabularInline):
    model = ContractOptionRule
    extra = 0


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("title", "legal_name", "tax_id", "phone", "is_active")
    list_filter = ("is_active",)
    search_fields = ("title", "legal_name", "tax_id", "phone", "email")


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ("number", "company", "status", "starts_on", "ends_on")
    list_filter = ("status", "company", "starts_on")
    search_fields = ("number", "title", "company__title", "company__legal_name")
    readonly_fields = ("created_at", "updated_at")
    inlines = (
        ContractVehicleInline,
        ContractServiceRuleInline,
        ContractOptionRuleInline,
    )


@admin.register(ContractVehicle)
class ContractVehicleAdmin(admin.ModelAdmin):
    list_display = (
        "vehicle_number",
        "normalized_vehicle_number",
        "contract",
        "vehicle_type",
        "is_active",
    )
    list_filter = ("is_active", "vehicle_type__group", "vehicle_type")
    search_fields = (
        "vehicle_number",
        "normalized_vehicle_number",
        "title",
        "contract__number",
        "contract__company__title",
    )


@admin.register(ContractServiceRule)
class ContractServiceRuleAdmin(admin.ModelAdmin):
    list_display = (
        "contract",
        "service_offering",
        "custom_price",
        "custom_duration_minutes",
        "is_allowed",
    )
    list_filter = ("is_allowed", "service_offering__service", "service_offering__vehicle_type")
    search_fields = ("contract__number", "contract__company__title")


@admin.register(ContractOptionRule)
class ContractOptionRuleAdmin(admin.ModelAdmin):
    list_display = (
        "contract",
        "option",
        "custom_price",
        "custom_extra_duration_minutes",
        "is_allowed",
    )
    list_filter = ("is_allowed", "option")
    search_fields = ("contract__number", "contract__company__title", "option__title")
