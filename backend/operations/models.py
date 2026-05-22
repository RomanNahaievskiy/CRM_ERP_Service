from django.db import models


class BusinessSettings(models.Model):
    title = models.CharField(max_length=120, default="Default settings")
    slot_step_minutes = models.PositiveIntegerField(default=15)
    booking_days_ahead = models.PositiveIntegerField(default=7)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Business settings"
        verbose_name_plural = "Business settings"
        ordering = ["-is_active", "title"]

    def __str__(self):
        return self.title


class Location(models.Model):
    id = models.SlugField(max_length=64, primary_key=True)
    title = models.CharField(max_length=160)
    address = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-is_default", "title"]

    def __str__(self):
        return self.title


class BusinessHours(models.Model):
    class Weekday(models.IntegerChoices):
        MONDAY = 0, "Monday"
        TUESDAY = 1, "Tuesday"
        WEDNESDAY = 2, "Wednesday"
        THURSDAY = 3, "Thursday"
        FRIDAY = 4, "Friday"
        SATURDAY = 5, "Saturday"
        SUNDAY = 6, "Sunday"

    location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="business_hours",
    )
    weekday = models.PositiveSmallIntegerField(choices=Weekday.choices)
    opens_at = models.TimeField()
    closes_at = models.TimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["location", "weekday", "opens_at"]
        verbose_name = "Business hours"
        verbose_name_plural = "Business hours"

    def __str__(self):
        return f"{self.location} {self.get_weekday_display()} {self.opens_at}-{self.closes_at}"


class WorkBreak(models.Model):
    location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="work_breaks",
    )
    service_post = models.ForeignKey(
        "booking.ServicePost",
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name="work_breaks",
    )
    weekday = models.PositiveSmallIntegerField(choices=BusinessHours.Weekday.choices)
    starts_at = models.TimeField()
    ends_at = models.TimeField()
    title = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["location", "weekday", "starts_at"]

    def __str__(self):
        label = self.title or "Break"
        owner = self.service_post or self.location
        return f"{owner} {label} {self.starts_at}-{self.ends_at}"


class ServicePostHours(models.Model):
    service_post = models.ForeignKey(
        "booking.ServicePost",
        on_delete=models.CASCADE,
        related_name="working_hours",
    )
    weekday = models.PositiveSmallIntegerField(choices=BusinessHours.Weekday.choices)
    opens_at = models.TimeField()
    closes_at = models.TimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["service_post", "weekday", "opens_at"]
        verbose_name = "Service post hours"
        verbose_name_plural = "Service post hours"

    def __str__(self):
        return f"{self.service_post} {self.get_weekday_display()} {self.opens_at}-{self.closes_at}"


class OperatorContact(models.Model):
    location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name="operator_contacts",
    )
    title = models.CharField(max_length=120)
    phone = models.CharField(max_length=32)
    telegram_username = models.CharField(max_length=80, blank=True)
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-is_primary", "title"]

    def __str__(self):
        return f"{self.title} {self.phone}"
