from django.contrib import admin

from .models import AdminOperatorProfile


@admin.register(AdminOperatorProfile)
class AdminOperatorProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "role",
        "location",
        "phone",
        "telegram_username",
        "can_reset_password_via_telegram",
        "is_active",
    )
    list_filter = ("role", "location", "can_reset_password_via_telegram", "is_active")
    search_fields = (
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
        "phone",
        "telegram_username",
        "telegram_user_id",
    )
    autocomplete_fields = ("user", "location")
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "user",
                    "role",
                    "location",
                    "is_active",
                )
            },
        ),
        (
            "Contact",
            {
                "fields": (
                    "phone",
                    "telegram_user_id",
                    "telegram_username",
                )
            },
        ),
        (
            "Password reset",
            {
                "fields": ("can_reset_password_via_telegram",)
            },
        ),
    )
