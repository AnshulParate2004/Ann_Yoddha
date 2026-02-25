"""
SMS and app alerts for diagnostic reports and outbreak notifications.
"""
from typing import Any

# TODO: Integrate SMS provider (Twilio, etc.) and in-app push from config


def send_sms(phone: str, message: str) -> bool:
    """
    Send SMS to farmer (e.g. diagnosis summary or alert).
    """
    # TODO: call SMS API
    return False


def send_app_alert(user_id: str, title: str, body: str, data: dict[str, Any] | None = None) -> bool:
    """
    Send in-app notification (e.g. FCM or similar).
    """
    # TODO: push notification
    return False
