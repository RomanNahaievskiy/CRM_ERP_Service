from datetime import timedelta

from django.http import JsonResponse
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_GET

from booking.models import ServicePost

from .services import get_schedule_for_date


def minutes_to_time_label(value):
    hours = value // 60
    minutes = value % 60

    return f"{hours:02d}:{minutes:02d}"


@require_GET
def schedule(request):
    start_date = parse_date(request.GET.get("startDate", ""))
    if start_date is None:
        return JsonResponse({"error": "Invalid startDate"}, status=400)

    try:
        days_count = int(request.GET.get("days", "14"))
    except ValueError:
        return JsonResponse({"error": "Invalid days"}, status=400)

    days_count = max(1, min(days_count, 31))
    result_days = []
    slot_step_minutes = None

    for offset in range(days_count):
        date_value = start_date + timedelta(days=offset)
        day_schedule = get_schedule_for_date(date_value)
        slot_step_minutes = day_schedule.slot_step_minutes
        service_posts = ServicePost.objects.select_related("location").filter(
            is_active=True,
        ).order_by("sort_order", "title")

        result_days.append(
            {
                "date": date_value.isoformat(),
                "workingWindows": [
                    {
                        "startMinutes": start_minutes,
                        "endMinutes": end_minutes,
                        "startsAt": minutes_to_time_label(start_minutes),
                        "endsAt": minutes_to_time_label(end_minutes),
                    }
                    for start_minutes, end_minutes in day_schedule.working_windows
                ],
                "posts": [
                    {
                        "id": service_post.id,
                        "title": service_post.title,
                        "workingWindows": [
                            {
                                "startMinutes": start_minutes,
                                "endMinutes": end_minutes,
                                "startsAt": minutes_to_time_label(start_minutes),
                                "endsAt": minutes_to_time_label(end_minutes),
                            }
                            for start_minutes, end_minutes in get_schedule_for_date(
                                date_value,
                                service_post=service_post,
                            ).working_windows
                        ],
                    }
                    for service_post in service_posts
                ],
            }
        )

    return JsonResponse(
        {
            "slotStepMinutes": slot_step_minutes or 15,
            "days": result_days,
        }
    )
