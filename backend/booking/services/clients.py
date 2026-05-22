from booking.models import Client
from common.normalization import normalize_phone_number


# Returns saved client contact data for bot UX shortcuts.
# Дістає збережені контактні дані клієнта для швидкого кроку телефону в боті.
def get_client_contact_by_telegram_id(telegram_user_id):
    if not telegram_user_id:
        return {
            "found": False,
            "phone": "",
            "fullName": "",
            "username": "",
        }

    client = (
        Client.objects.filter(telegram_user_id=telegram_user_id)
        .only("phone", "full_name", "username")
        .first()
    )
    normalized_phone = normalize_phone_number(client.phone) if client else ""
    if client is None or not normalized_phone:
        return {
            "found": False,
            "phone": "",
            "fullName": "",
            "username": "",
        }

    return {
        "found": True,
        "phone": normalized_phone,
        "fullName": client.full_name,
        "username": client.username,
    }
