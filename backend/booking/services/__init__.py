# Public facade for the booking service layer.
# Views import from here instead of reaching into individual service modules.
from .errors import ServiceError

__all__ = [
    "ServiceError",
]
