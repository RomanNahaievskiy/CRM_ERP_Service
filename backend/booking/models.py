from django.db import models

from common.normalization import normalize_vehicle_number


# VehicleGroup is a managed category for vehicle types.
# Examples: passenger, cargo, tanker. Admin can edit these without code changes.
class VehicleGroup(models.Model):
    id = models.SlugField(max_length=64, primary_key=True)
    title = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title


# VehicleType describes one kind of vehicle that can receive a service.
# Examples from the spreadsheet: micro_18, bus_30, bus_double, truck_10t.
class VehicleType(models.Model):
    id = models.SlugField(max_length=64, primary_key=True)
    group = models.ForeignKey(
        VehicleGroup,
        on_delete=models.PROTECT,
        db_column="group",
        related_name="vehicle_types",
    )
    title = models.CharField(max_length=160)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["group", "title"]

    def __str__(self):
        return self.title


# Service describes the main service selected by a client.
# Examples: wash, suspension_diagnostics, interior_cleaning.
class Service(models.Model):
    id = models.SlugField(max_length=64, primary_key=True)
    title = models.CharField(max_length=160)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title


# ServiceOffering describes a concrete bookable offer:
# one service for one vehicle type, with its own price and duration.
class ServiceOffering(models.Model):
    service = models.ForeignKey(
        Service,
        on_delete=models.CASCADE,
        related_name="offerings",
    )
    vehicle_type = models.ForeignKey(
        VehicleType,
        on_delete=models.PROTECT,
        related_name="service_offerings",
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_minutes = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["service__title", "vehicle_type__group", "vehicle_type__title"]
        constraints = [
            models.UniqueConstraint(
                fields=["service", "vehicle_type"],
                name="unique_service_offering_per_vehicle_type",
            )
        ]

    def __str__(self):
        return f"{self.service} - {self.vehicle_type}"


# ServiceOption describes an extra option that can be added to a booking.
# Examples: interior cleaning, undercarriage wash, engine wash, trailer wash.
class ServiceOption(models.Model):
    class SelectMode(models.TextChoices):
        SINGLE = "single", "Single"
        MULTI = "multi", "Multi"

    id = models.SlugField(max_length=96, primary_key=True)
    title = models.CharField(max_length=160)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    extra_duration_minutes = models.PositiveIntegerField(default=0)
    applicable_group = models.ForeignKey(
        VehicleGroup,
        on_delete=models.PROTECT,
        db_column="applicable_group",
        blank=True,
        null=True,
        related_name="available_options",
    )
    applicable_vehicle_type = models.ForeignKey(
        VehicleType,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="available_options",
    )
    option_group = models.CharField(max_length=64, blank=True)
    select_mode = models.CharField(
        max_length=16,
        choices=SelectMode.choices,
        default=SelectMode.MULTI,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        parts = [self.title]
        if self.applicable_vehicle_type:
            parts.append(self.applicable_vehicle_type.title)
        elif self.applicable_group:
            parts.append(self.applicable_group.title)
        if self.option_group:
            parts.append(self.option_group)

        parts.append(self.id)
        return " | ".join(parts)


class ServiceOfferingOption(models.Model):
    service_offering = models.ForeignKey(
        ServiceOffering,
        on_delete=models.CASCADE,
        related_name="available_options",
    )
    option = models.ForeignKey(
        ServiceOption,
        on_delete=models.PROTECT,
        related_name="offering_links",
    )
    is_active = models.BooleanField(default=True)
    is_required = models.BooleanField(default=False)
    price_override = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    extra_duration_override = models.PositiveIntegerField(blank=True, null=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "option__title"]
        constraints = [
            models.UniqueConstraint(
                fields=["service_offering", "option"],
                name="unique_option_per_service_offering",
            )
        ]

    def __str__(self):
        return f"{self.service_offering} - {self.option}"


class ServicePost(models.Model):
    id = models.SlugField(max_length=64, primary_key=True)
    location = models.ForeignKey(
        "operations.Location",
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="service_posts",
    )
    title = models.CharField(max_length=120)
    supported_services = models.ManyToManyField(
        Service,
        blank=True,
        related_name="service_posts",
    )
    supported_options = models.ManyToManyField(
        ServiceOption,
        blank=True,
        related_name="service_posts",
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "title"]

    def __str__(self):
        return self.title


# Client stores Telegram user/contact data.
# A client can have many bookings over time.
class Client(models.Model):
    telegram_user_id = models.BigIntegerField(unique=True, blank=True, null=True)
    telegram_chat_id = models.BigIntegerField(blank=True, null=True)
    phone = models.CharField(max_length=32, blank=True)
    full_name = models.CharField(max_length=160, blank=True)
    username = models.CharField(max_length=80, blank=True)
    first_seen_at = models.DateTimeField(blank=True, null=True)
    last_seen_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["full_name", "phone"]

    def __str__(self):
        return self.full_name or self.phone or str(self.telegram_user_id)


# Booking is the actual appointment.
# It connects client + concrete service offering + selected options + time/status.
class Booking(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELED = "canceled", "Canceled"
        DONE = "done", "Done"
        NO_SHOW = "no_show", "No show"

    class ClientType(models.TextChoices):
        RETAIL = "retail", "Retail"
        CONTRACT = "contract", "Contract"
        SYSTEM = "system", "System"

    external_id = models.CharField(max_length=64, unique=True, blank=True)
    client = models.ForeignKey(
        Client,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="bookings",
    )
    service_offering = models.ForeignKey(
        ServiceOffering,
        on_delete=models.PROTECT,
        related_name="bookings",
    )
    service_post = models.ForeignKey(
        ServicePost,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="bookings",
    )
    options = models.ManyToManyField(ServiceOption, blank=True, related_name="bookings")
    vehicle_number = models.CharField(max_length=32, blank=True)
    normalized_vehicle_number = models.CharField(max_length=32, db_index=True, blank=True)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    client_type = models.CharField(
        max_length=16,
        choices=ClientType.choices,
        default=ClientType.RETAIL,
    )
    total_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    total_duration_minutes = models.PositiveIntegerField(blank=True, null=True)
    comment = models.TextField(blank=True)
    admin = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-starts_at"]

    def __str__(self):
        return f"{self.starts_at:%Y-%m-%d %H:%M} - {self.vehicle_number or self.service_offering}"

    def save(self, *args, **kwargs):
        self.normalized_vehicle_number = normalize_vehicle_number(self.vehicle_number)
        super().save(*args, **kwargs)


class BookingPostAllocation(models.Model):
    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name="post_allocations",
    )
    service_post = models.ForeignKey(
        ServicePost,
        on_delete=models.PROTECT,
        related_name="post_allocations",
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="post_allocations",
    )
    service_option = models.ForeignKey(
        ServiceOption,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="post_allocations",
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["starts_at", "sort_order"]
        indexes = [
            models.Index(fields=["service_post", "starts_at", "ends_at"]),
        ]

    def __str__(self):
        stage = self.service_option or self.service
        return f"{self.service_post} {self.starts_at:%H:%M}-{self.ends_at:%H:%M} {stage}"
