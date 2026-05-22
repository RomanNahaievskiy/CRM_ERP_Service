from django.conf import settings
from django.db import models

from .permissions import GROUP_ADMINISTRATORS, GROUP_OPERATORS, GROUP_SUPERADMINS


class AdminOperatorProfile(models.Model):
    class Role(models.TextChoices):
        SUPERADMIN = "superadmin", "Superadmin"
        ADMINISTRATOR = "administrator", "Administrator"
        OPERATOR = "operator", "Operator"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="admin_operator_profile",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.OPERATOR,
    )
    location = models.ForeignKey(
        "operations.Location",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="admin_operator_profiles",
    )
    phone = models.CharField(max_length=32, blank=True)
    telegram_user_id = models.BigIntegerField(blank=True, null=True, unique=True)
    telegram_username = models.CharField(max_length=80, blank=True)
    can_reset_password_via_telegram = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["user__username"]
        permissions = [
            ("access_admin_panel", "Can access the admin operations panel"),
        ]

    def __str__(self):
        return f"{self.user} ({self.get_role_display()})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.sync_user_access()

    def sync_user_access(self):
        from django.contrib.auth.models import Group

        role_group_map = {
            self.Role.SUPERADMIN: GROUP_SUPERADMINS,
            self.Role.ADMINISTRATOR: GROUP_ADMINISTRATORS,
            self.Role.OPERATOR: GROUP_OPERATORS,
        }
        managed_group_names = set(role_group_map.values())
        target_group_name = role_group_map[self.role]
        target_group, _ = Group.objects.get_or_create(name=target_group_name)

        self.user.groups.remove(*Group.objects.filter(name__in=managed_group_names))
        self.user.groups.add(target_group)

        if not self.user.is_staff:
            self.user.is_staff = True
            self.user.save(update_fields=["is_staff"])
