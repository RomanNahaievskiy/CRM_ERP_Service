from django.urls import path

from . import views

urlpatterns = [
    path("contracts/stats/", views.contract_stats, name="contracts-api-stats"),
]
