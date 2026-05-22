from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase

from accounts.models import AdminOperatorProfile
from accounts.permissions import (
    GROUP_ADMINISTRATORS,
    GROUP_OPERATORS,
    GROUP_SUPERADMINS,
    ensure_staff_groups,
)
from operations.models import Location


class AdminOperatorProfileTest(TestCase):
    def test_profile_links_django_user_to_operator_metadata(self):
        user = get_user_model().objects.create_user(
            username="operator",
            email="operator@example.com",
            password="secret-pass-123",
        )
        location = Location.objects.create(
            id="profile-test-location",
            title="Main wash location",
        )

        profile = AdminOperatorProfile.objects.create(
            user=user,
            role=AdminOperatorProfile.Role.OPERATOR,
            location=location,
            phone="+380501112233",
            telegram_user_id=123456789,
            telegram_username="washbot_operator",
            can_reset_password_via_telegram=True,
        )

        self.assertEqual(user.admin_operator_profile, profile)
        self.assertEqual(profile.location, location)
        self.assertEqual(str(profile), "operator (Operator)")
        self.assertTrue(user.groups.filter(name=GROUP_OPERATORS).exists())
        user.refresh_from_db()
        self.assertTrue(user.is_staff)

    def test_profile_role_syncs_user_group(self):
        user = get_user_model().objects.create_user(
            username="administrator",
            email="administrator@example.com",
            password="secret-pass-123",
        )
        profile = AdminOperatorProfile.objects.create(
            user=user,
            role=AdminOperatorProfile.Role.OPERATOR,
        )

        profile.role = AdminOperatorProfile.Role.ADMINISTRATOR
        profile.save()

        self.assertTrue(user.groups.filter(name=GROUP_ADMINISTRATORS).exists())
        self.assertFalse(user.groups.filter(name=GROUP_OPERATORS).exists())

    def test_staff_groups_have_expected_permissions(self):
        ensure_staff_groups()

        superadmins = Group.objects.get(name=GROUP_SUPERADMINS)
        administrators = Group.objects.get(name=GROUP_ADMINISTRATORS)
        operators = Group.objects.get(name=GROUP_OPERATORS)

        self.assertTrue(superadmins.permissions.filter(codename="add_user").exists())
        self.assertTrue(administrators.permissions.filter(codename="add_user").exists())
        self.assertTrue(administrators.permissions.filter(codename="change_businesssettings").exists())

        self.assertTrue(operators.permissions.filter(codename="view_booking").exists())
        self.assertTrue(operators.permissions.filter(codename="add_booking").exists())
        self.assertTrue(operators.permissions.filter(codename="change_booking").exists())
        self.assertTrue(operators.permissions.filter(codename="delete_booking").exists())
        self.assertTrue(operators.permissions.filter(codename="access_admin_panel").exists())
        self.assertFalse(operators.permissions.filter(codename="add_user").exists())
        self.assertFalse(operators.permissions.filter(codename="change_businesssettings").exists())
