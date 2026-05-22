from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType


GROUP_SUPERADMINS = "superadmins"
GROUP_ADMINISTRATORS = "administrators"
GROUP_OPERATORS = "operators"

GROUPS = (GROUP_SUPERADMINS, GROUP_ADMINISTRATORS, GROUP_OPERATORS)

AUTH_USER_PERMISSIONS = (
    ("auth", "user", "add"),
    ("auth", "user", "change"),
    ("auth", "user", "view"),
)

AUTH_GROUP_VIEW_PERMISSIONS = (
    ("auth", "group", "view"),
)

ADMIN_PROFILE_PERMISSIONS = (
    ("accounts", "adminoperatorprofile", "add"),
    ("accounts", "adminoperatorprofile", "change"),
    ("accounts", "adminoperatorprofile", "view"),
    ("accounts", "adminoperatorprofile", "access_admin_panel"),
)

BUSINESS_LOGIC_PERMISSIONS = (
    ("operations", "businesssettings"),
    ("operations", "location"),
    ("operations", "businesshours"),
    ("operations", "workbreak"),
    ("operations", "serviceposthours"),
    ("operations", "operatorcontact"),
    ("booking", "vehiclegroup"),
    ("booking", "vehicletype"),
    ("booking", "service"),
    ("booking", "serviceoffering"),
    ("booking", "serviceoption"),
    ("booking", "serviceofferingoption"),
    ("booking", "servicepost"),
    ("contracts", "company"),
    ("contracts", "contract"),
    ("contracts", "contractvehicle"),
    ("contracts", "contractservicerule"),
    ("contracts", "contractoptionrule"),
    ("pricing", "pricelist"),
    ("pricing", "serviceofferingprice"),
    ("pricing", "serviceoptionprice"),
    ("reminders", "remindersetting"),
)

BOOKING_OPERATION_PERMISSIONS = (
    ("booking", "booking"),
    ("booking", "bookingpostallocation"),
    ("booking", "client"),
)

BOOKING_REFERENCE_VIEW_PERMISSIONS = (
    ("booking", "service"),
    ("booking", "serviceoffering"),
    ("booking", "serviceoption"),
    ("booking", "servicepost"),
    ("booking", "vehicletype"),
    ("booking", "vehiclegroup"),
    ("pricing", "pricelist"),
    ("pricing", "serviceofferingprice"),
    ("pricing", "serviceoptionprice"),
    ("contracts", "company"),
    ("contracts", "contract"),
    ("contracts", "contractvehicle"),
    ("operations", "location"),
)


def ensure_staff_groups():
    groups = {name: Group.objects.get_or_create(name=name)[0] for name in GROUPS}

    superadmin_permissions = Permission.objects.all()
    groups[GROUP_SUPERADMINS].permissions.set(superadmin_permissions)

    administrator_permissions = (
        _permissions_for_actions(BUSINESS_LOGIC_PERMISSIONS, ("add", "change", "delete", "view"))
        | _permissions_from_specs(AUTH_USER_PERMISSIONS)
        | _permissions_from_specs(AUTH_GROUP_VIEW_PERMISSIONS)
        | _permissions_from_specs(ADMIN_PROFILE_PERMISSIONS)
    )
    groups[GROUP_ADMINISTRATORS].permissions.set(administrator_permissions)

    operator_permissions = (
        _permissions_for_actions(BOOKING_OPERATION_PERMISSIONS, ("add", "change", "delete", "view"))
        | _permissions_for_actions(BOOKING_REFERENCE_VIEW_PERMISSIONS, ("view",))
        | _permissions_from_specs((("accounts", "adminoperatorprofile", "access_admin_panel"),))
    )
    groups[GROUP_OPERATORS].permissions.set(operator_permissions)


def _permissions_for_actions(model_specs, actions):
    specs = []
    for app_label, model in model_specs:
        specs.extend((app_label, model, action) for action in actions)
    return _permissions_from_specs(specs)


def _permissions_from_specs(specs):
    permissions = Permission.objects.none()
    for app_label, model, action in specs:
        content_type = ContentType.objects.filter(app_label=app_label, model=model).first()
        if not content_type:
            continue

        codename = action if action.startswith(f"{action}_") else _permission_codename(action, model)
        permission = Permission.objects.filter(content_type=content_type, codename=codename).first()
        if permission:
            permissions |= Permission.objects.filter(pk=permission.pk)

    return permissions


def _permission_codename(action, model):
    if action in {"add", "change", "delete", "view"}:
        return f"{action}_{model}"
    return action
