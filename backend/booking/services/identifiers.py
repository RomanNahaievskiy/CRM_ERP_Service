# Identifier helpers:
# translate internal model relations into stable public ids used by the bot/API.
# Builds the public id used by the API instead of exposing a DB primary key.
def offering_public_id(offering):
    return f"{offering.service_id}__{offering.vehicle_type_id}"


# Splits the public offering id back into service id and vehicle type id.
# Розбиває публічний ідентифікатор пропозиції назад на id сервісу та id типу транспортного засоба.
def parse_public_offering_id(value):
    if not isinstance(value, str) or "__" not in value:
        return None, None

    return value.split("__", 1)
