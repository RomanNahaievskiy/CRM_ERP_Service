# Shared normalization helpers for user-entered business identifiers.
import phonenumbers
from phonenumbers import NumberParseException, PhoneNumberFormat

VEHICLE_NUMBER_TRANSLATION = str.maketrans(
    {
        "А": "A",
        "В": "B",
        "С": "C",
        "Е": "E",
        "Н": "H",
        "І": "I",
        "К": "K",
        "М": "M",
        "О": "O",
        "Р": "P",
        "Т": "T",
        "Х": "X",
        "Ё": "E",
        "Ї": "I",
        "Й": "Y",
        "З": "Z",
        "Л": "L",
        "У": "Y",
    }
)


# Normalizes plate-like values for matching contract vehicles and bookings.
def normalize_vehicle_number(value):
    if not isinstance(value, str):
        return ""

    translated = value.upper().translate(VEHICLE_NUMBER_TRANSLATION)
    return "".join(char for char in translated if char.isalnum())


# Normalizes phone numbers to E.164, using Ukraine as the default local region.
def normalize_phone_number(value, default_region="UA"):
    if not isinstance(value, str):
        return ""

    raw = value.strip()
    if not raw:
        return ""

    if raw.startswith("00"):
        raw = f"+{raw[2:]}"

    region = None if raw.startswith("+") else default_region
    try:
        parsed = phonenumbers.parse(raw, region)
    except NumberParseException:
        return ""

    if not phonenumbers.is_valid_number(parsed):
        return ""

    return phonenumbers.format_number(parsed, PhoneNumberFormat.E164)
