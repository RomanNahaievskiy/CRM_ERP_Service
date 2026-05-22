# Allocation service: // Сервіс алокації:
# будує маршрут виконання бронювання та підбирає конкретні сервісні пости.
# Тут вирішується "який бокс/ресурс зайнятий в цей час?".

from datetime import timedelta

from booking.models import Booking, BookingPostAllocation, ServicePost
from operations.services import is_service_post_available

BLOCKING_BOOKING_STATUSES = [Booking.Status.NEW, Booking.Status.CONFIRMED]


# Returns allocations that overlap the requested time range.
def overlapping_allocations(starts_at, ends_at):
    return BookingPostAllocation.objects.filter(
        booking__status__in=BLOCKING_BOOKING_STATUSES,
        starts_at__lt=ends_at,
        ends_at__gt=starts_at,
    )


# Finds active posts that can perform the main service.
def candidate_posts_for_service(service_id, lock=False):
    posts = ServicePost.objects.select_related("location").filter(is_active=True).order_by(
        "sort_order",
        "title",
    )
    if lock:
        posts = posts.select_for_update()

    return [
        post
        for post in posts.prefetch_related("supported_services")
        if post.supported_services.filter(id=service_id).exists()
    ]


# Finds active posts that can perform a selected extra option.
def candidate_posts_for_option(option_id, lock=False):
    posts = ServicePost.objects.select_related("location").filter(is_active=True).order_by(
        "sort_order",
        "title",
    )
    if lock:
        posts = posts.select_for_update()

    return [
        post
        for post in posts.prefetch_related("supported_options")
        if post.supported_options.filter(id=option_id).exists()
    ]


# Converts one booking request into ordered execution stages.
def build_booking_stages(
    offering,
    options,
    starts_at,
    service_duration_minutes=None,
    option_duration_minutes_by_id=None,
):
    option_duration_minutes_by_id = option_duration_minutes_by_id or {}
    stages = []
    cursor = starts_at

    service_duration_minutes = service_duration_minutes or offering.duration_minutes
    service_ends_at = cursor + timedelta(minutes=service_duration_minutes)
    stages.append(
        {
            "type": "service",
            "service": offering.service,
            "service_option": None,
            "starts_at": cursor,
            "ends_at": service_ends_at,
            "duration_minutes": service_duration_minutes,
        }
    )
    cursor = service_ends_at

    for option in options:
        option_duration_minutes = option_duration_minutes_by_id.get(
            option.id,
            option.extra_duration_minutes,
        )
        if option_duration_minutes <= 0:
            continue

        option_ends_at = cursor + timedelta(minutes=option_duration_minutes)
        stages.append(
            {
                "type": "option",
                "service": None,
                "service_option": option,
                "starts_at": cursor,
                "ends_at": option_ends_at,
                "duration_minutes": option_duration_minutes,
            }
        )
        cursor = option_ends_at

    return stages


# Chooses candidate posts for a single stage type.
def candidate_posts_for_stage(stage, lock=False):
    if stage["type"] == "service":
        return candidate_posts_for_service(stage["service"].id, lock=lock)

    return candidate_posts_for_option(stage["service_option"].id, lock=lock)


# Builds a full route across posts, or returns None if any stage cannot fit.
def find_allocation_plan(stages, lock=False, first_stage_post_id=None):
    plan = []

    for index, stage in enumerate(stages):
        posts = candidate_posts_for_stage(stage, lock=lock)
        if index == 0 and first_stage_post_id:
            posts = [post for post in posts if post.id == first_stage_post_id]

        selected_post = None
        for post in posts:
            if not is_service_post_available(post, stage["starts_at"], stage["ends_at"]):
                continue

            if not overlapping_allocations(
                stage["starts_at"],
                stage["ends_at"],
            ).filter(service_post=post).exists():
                selected_post = post
                break

        if selected_post is None:
            return None

        plan.append({**stage, "service_post": selected_post})

    return plan


# Persists the selected route as BookingPostAllocation rows.
def create_allocations(booking, allocation_plan):
    for index, item in enumerate(allocation_plan):
        BookingPostAllocation.objects.create(
            booking=booking,
            service_post=item["service_post"],
            service=item["service"],
            service_option=item["service_option"],
            starts_at=item["starts_at"],
            ends_at=item["ends_at"],
            sort_order=index,
        )
