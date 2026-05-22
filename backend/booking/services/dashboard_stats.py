from django.utils import timezone
from booking.models import Booking



def get_bookings_stat():
    now = timezone.now()

    active_statuses = [
        Booking.Status.NEW,
        Booking.Status.CONFIRMED,
    ]

    try:
        # Тут буде логіка для отримання статистики бронювань, наприклад, кількість бронювань за певний період, розподіл за статусами тощо.
  
        # future_bookings = Booking.objects.filter(starts_at__gte=now).count()
        total_bookings = Booking.objects.count()
        upcoming_bookings = Booking.objects.filter(starts_at__gte=now, status__in=active_statuses,).count()
        past_bookings = Booking.objects.filter(starts_at__lt=now).count()
        canceled_bookings = Booking.objects.filter(status=Booking.Status.CANCELED).count()
        no_show_bookings = Booking.objects.filter(status=Booking.Status.NO_SHOW).count()

        return {
            "totalBookings": total_bookings,
            "bookingsByStatus": {
                "canceled": canceled_bookings,
                "no_show": no_show_bookings,
                "upcomingBookingsCount": upcoming_bookings,
                "pastBookingsCount": past_bookings
            },
            # Можна додати більше статистичних даних за потреби.

        }
    except Exception as e:
        # Обробка помилок
        print(f"Error occurred while fetching booking stats: {e}")
        return {
            "totalBookings": 0,
            "bookingsByStatus": {
                "canceled": 0,
                "no_show": 0,
                "upcomingBookingsCount": 0,
                "pastBookingsCount": 0
            }
        }