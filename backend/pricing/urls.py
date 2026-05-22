from django.urls import path

from . import views

urlpatterns = [
    path("resolve/", views.resolve_pricing, name="pricing-api-resolve"),
]
