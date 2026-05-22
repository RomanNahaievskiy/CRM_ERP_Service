# Operations service:
# reads business configuration from the operations domain.
# Booking uses this module to know when locations and service posts are available.
from dataclasses import dataclass
from datetime import time

from django.db.models import Q
from django.utils import timezone

from .models import BusinessHours, BusinessSettings, Location, ServicePostHours, WorkBreak

DEFAULT_SLOT_STEP_MINUTES = 15
DEFAULT_WORKDAY_START = time(hour=8)
DEFAULT_WORKDAY_END = time(hour=20)


@dataclass(frozen=True)
class OperationsSchedule:
    slot_step_minutes: int
    working_windows: list[tuple[int, int]]


# Returns the active global business settings row.
# Повертає активний ряд глобальних бізнес-налаштувань.
def get_active_settings():
    return BusinessSettings.objects.filter(is_active=True).first()


# Chooses the default active location used when the API did not specify one.
# Вибирає активну локацію за замовчуванням, коли API не вказав конкретну.
def get_default_location():
    return (
        Location.objects.filter(is_active=True, is_default=True).first()
        or Location.objects.filter(is_active=True).first()
    )


# Builds effective working windows for a location or a concrete service post.
# Будує ефективні робочі вікна для локації або конкретного сервісного поста.
def get_schedule_for_date(date_value, location=None, service_post=None):
    settings = get_active_settings()
    slot_step_minutes = (
        settings.slot_step_minutes if settings else DEFAULT_SLOT_STEP_MINUTES
    )

    if service_post is not None and location is None:
        location = service_post.location

    location = location or get_default_location()
    if location is None:
        return OperationsSchedule(
            slot_step_minutes=slot_step_minutes,
            working_windows=[
                (time_to_minutes(DEFAULT_WORKDAY_START), time_to_minutes(DEFAULT_WORKDAY_END)),
            ],
        )

    weekday = date_value.weekday()
    hours = get_hours_queryset(location, service_post, weekday)

    windows = [
        (time_to_minutes(item.opens_at), time_to_minutes(item.closes_at))
        for item in hours
        if item.opens_at < item.closes_at
    ]
    if not windows:
        return OperationsSchedule(slot_step_minutes=slot_step_minutes, working_windows=[])

    breaks = get_break_windows(location, service_post, weekday)

    for break_start, break_end in breaks:
        windows = split_windows_by_break(windows, break_start, break_end)

    return OperationsSchedule(slot_step_minutes=slot_step_minutes, working_windows=windows)


# Uses post-specific hours when they exist; otherwise falls back to location hours.
# Використовує години, специфічні для поста, коли вони існують; в протилежному випадку повертається до годин локації.
def get_hours_queryset(location, service_post, weekday):
    if service_post is not None:
        post_hours = ServicePostHours.objects.filter(
            service_post=service_post,
            weekday=weekday,
            is_active=True,
        ).order_by("opens_at")
        if post_hours.exists():
            return post_hours

    return BusinessHours.objects.filter(
        location=location,
        weekday=weekday,
        is_active=True,
    ).order_by("opens_at")


# Returns break windows that affect either the whole location or one post.
# Повертає вікна перерв, які впливають на всю локацію або один пост.
def get_break_windows(location, service_post, weekday):
    breaks = WorkBreak.objects.filter(
        location=location,
        weekday=weekday,
        is_active=True,
    )
    if service_post is not None:
        breaks = breaks.filter(Q(service_post__isnull=True) | Q(service_post=service_post))
    else:
        breaks = breaks.filter(service_post__isnull=True)

    return [
        (time_to_minutes(item.starts_at), time_to_minutes(item.ends_at))
        for item in breaks.order_by("starts_at")
        if item.starts_at < item.ends_at
    ]


# Checks whether one service post can work for the entire requested interval.
# Перевіряє, чи може один сервисний пост працювати на протязі всього потрібного інтервалу.
def is_service_post_available(service_post, starts_at, ends_at):
    local_start = timezone.localtime(starts_at)
    local_end = timezone.localtime(ends_at)
    if local_start.date() != local_end.date():
        return False

    start_minutes = time_to_minutes(local_start.time())
    end_minutes = time_to_minutes(local_end.time())
    schedule = get_schedule_for_date(
        local_start.date(),
        service_post=service_post,
    )

    return any(
        window_start <= start_minutes and end_minutes <= window_end
        for window_start, window_end in schedule.working_windows
    )


# Subtracts one break interval from the current set of working windows.
# Віднімає один інтервал перерви від поточного набору робочих вікон.
def split_windows_by_break(windows, break_start, break_end):
    result = []
    for window_start, window_end in windows:
        if break_end <= window_start or break_start >= window_end:
            result.append((window_start, window_end))
            continue

        if window_start < break_start:
            result.append((window_start, break_start))
        if break_end < window_end:
            result.append((break_end, window_end))

    return result


# Converts a time object into minutes from midnight.
# Конвертує об'єкт часу в хвилини від півночі.
def time_to_minutes(value):
    return value.hour * 60 + value.minute
