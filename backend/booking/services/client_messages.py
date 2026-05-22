import json
from urllib import error, request

from django.conf import settings

from booking.models import Client

from .errors import ServiceError


MAX_MESSAGE_LENGTH = 4096
TELEGRAM_SEND_MESSAGE_URL = "https://api.telegram.org/bot{token}/sendMessage"


def send_client_message(client_id, text):
    message_text = normalize_message_text(text)
    client = get_message_client(client_id)

    response = send_telegram_message(
        chat_id=client.telegram_chat_id,
        text=message_text,
    )

    return {
        "client": {
            "id": client.id,
            "fullName": client.full_name,
            "telegramChatId": client.telegram_chat_id,
        },
        "message": {
            "text": message_text,
            "telegramMessageId": response.get("result", {}).get("message_id"),
        },
    }


def normalize_message_text(text):
    if not isinstance(text, str):
        raise ServiceError("Message text is required", status=400)

    message_text = text.strip()
    if not message_text:
        raise ServiceError("Message text is required", status=400)

    if len(message_text) > MAX_MESSAGE_LENGTH:
        raise ServiceError(
            f"Message text must be {MAX_MESSAGE_LENGTH} characters or less",
            status=400,
        )

    return message_text


def get_message_client(client_id):
    try:
        client = Client.objects.get(id=client_id)
    except Client.DoesNotExist as exc:
        raise ServiceError("Client not found", status=404) from exc

    if not client.telegram_chat_id:
        raise ServiceError("Client does not have a Telegram chat", status=400)

    return client


def send_telegram_message(chat_id, text):
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        raise ServiceError("Telegram bot token is not configured", status=500)

    payload = json.dumps(
        {
            "chat_id": chat_id,
            "text": text,
        }
    ).encode("utf-8")
    telegram_request = request.Request(
        TELEGRAM_SEND_MESSAGE_URL.format(token=token),
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(telegram_request, timeout=10) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        raise ServiceError(parse_telegram_error(exc), status=502) from exc
    except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise ServiceError(f"Telegram request failed: {exc}", status=502) from exc

    if not response_payload.get("ok"):
        description = response_payload.get("description") or "Telegram rejected the message"
        raise ServiceError(description, status=502)

    return response_payload


def parse_telegram_error(exc):
    try:
        payload = json.loads(exc.read().decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return f"Telegram request failed with status {exc.code}"

    return payload.get("description") or f"Telegram request failed with status {exc.code}"
