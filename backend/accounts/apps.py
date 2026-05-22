from django.apps import AppConfig
from django.db.models.signals import post_migrate


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    def ready(self):
        post_migrate.connect(create_staff_groups)


def create_staff_groups(**kwargs):
    from .permissions import ensure_staff_groups

    ensure_staff_groups()
