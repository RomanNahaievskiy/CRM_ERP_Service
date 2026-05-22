from django.urls import path

from . import views

urlpatterns = [
    path("availability/", views.availability, name="booking-api-availability"),
    path("catalog/", views.catalog, name="booking-api-catalog"),
    path(
        "clients/telegram/<int:telegram_user_id>/",
        views.client_by_telegram,
        name="booking-api-client-by-telegram",
    ),
    path("clients/", views.clients, name="booking-api-clients"),
    path("clients/<int:client_id>/messages/", views.client_messages, name="booking-api-client-messages"),
    path("bookings/", views.bookings, name="booking-api-bookings"),
    path("bookings/stats/", views.booking_stats, name="booking-api-booking-stats"),
    path("bookings/<int:booking_id>/cancel/", views.cancel_booking, name="booking-api-booking-cancel"), 
    path("bookings/<int:booking_id>/no-show/", views.mark_booking_no_show, name="booking-api-booking-no-show"),
   
    #нижче нові роути та їх ендпоінти для редагування бронювання, перетягування та оновлення статусу бронювання
    #потребують реалізації у views.py та відповідних сервісах для обробки логіки цих операцій.
     
    # #редагування бронювання; (змінити опції , кількість послуг, дані клієнта тощо); )
    # path("bookings/<int:booking_id>/edit/", views.edit_booking, name="booking-api-booking-edit"), 

    # #перетягування бронювання на інший слот (зміна дати та часу);  
    # path("bookings/move/", views.move_booking, name="booking-api-booking-move"),
    # #оновлення статусу бронювання (наприклад клієнт не з'явився);
    # path("booking/update-status/", views.update_booking, name="booking-api-booking-update"),
]
