from django.urls import path

from . import views

urlpatterns = [
    path("claim/", views.claim_due, name="reminders-api-claim-due"),
    path("<int:reminder_id>/sent/", views.mark_sent, name="reminders-api-mark-sent"),
    path("<int:reminder_id>/failed/", views.mark_failed, name="reminders-api-mark-failed"),
]

