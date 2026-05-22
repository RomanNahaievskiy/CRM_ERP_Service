from django.db import models

from common.normalization import normalize_vehicle_number


# Company is a B2B customer that can have one or more service contracts.
class Company(models.Model):
    title = models.CharField(max_length=180)
    legal_name = models.CharField(max_length=220, blank=True)
    tax_id = models.CharField(max_length=64, blank=True)
    contact_person = models.CharField(max_length=160, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["title"]
        verbose_name_plural = "companies"

    def __str__(self):
        return self.title


# Contract stores the commercial agreement that controls B2B booking terms.
class Contract(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        EXPIRED = "expired", "Expired"
        CANCELED = "canceled", "Canceled"

    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name="contracts",
    )
    number = models.CharField(max_length=80)
    title = models.CharField(max_length=180, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    starts_on = models.DateField()
    ends_on = models.DateField(blank=True, null=True)
    payment_terms = models.CharField(max_length=180, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["company", "-starts_on", "number"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "number"],
                name="unique_contract_number_per_company",
            )
        ]

    def __str__(self):
        return f"{self.company} - {self.number}"


# ContractVehicle declares which vehicles are covered by a specific contract.
class ContractVehicle(models.Model):
    contract = models.ForeignKey(
        Contract,
        on_delete=models.CASCADE,
        related_name="vehicles",
    )
    vehicle_number = models.CharField(max_length=32)
    normalized_vehicle_number = models.CharField(max_length=32, db_index=True, blank=True)
    vehicle_type = models.ForeignKey(
        "booking.VehicleType",
        on_delete=models.PROTECT,
        related_name="contract_vehicles",
    )
    title = models.CharField(max_length=160, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["normalized_vehicle_number", "vehicle_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["contract", "normalized_vehicle_number"],
                name="unique_normalized_vehicle_number_per_contract",
            )
        ]

    def __str__(self):
        return self.vehicle_number

    def save(self, *args, **kwargs):
        self.normalized_vehicle_number = normalize_vehicle_number(self.vehicle_number)
        super().save(*args, **kwargs)


# ContractServiceRule overrides retail service offering terms for one contract.
class ContractServiceRule(models.Model):
    contract = models.ForeignKey(
        Contract,
        on_delete=models.CASCADE,
        related_name="service_rules",
    )
    service_offering = models.ForeignKey(
        "booking.ServiceOffering",
        on_delete=models.PROTECT,
        related_name="contract_rules",
    )
    custom_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
    )
    custom_duration_minutes = models.PositiveIntegerField(blank=True, null=True)
    is_allowed = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["contract", "service_offering"]
        constraints = [
            models.UniqueConstraint(
                fields=["contract", "service_offering"],
                name="unique_service_rule_per_contract",
            )
        ]

    def __str__(self):
        return f"{self.contract} - {self.service_offering}"


# ContractOptionRule overrides retail option terms for one contract.
class ContractOptionRule(models.Model):
    contract = models.ForeignKey(
        Contract,
        on_delete=models.CASCADE,
        related_name="option_rules",
    )
    option = models.ForeignKey(
        "booking.ServiceOption",
        on_delete=models.PROTECT,
        related_name="contract_rules",
    )
    custom_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
    )
    custom_extra_duration_minutes = models.PositiveIntegerField(blank=True, null=True)
    is_allowed = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["contract", "option"]
        constraints = [
            models.UniqueConstraint(
                fields=["contract", "option"],
                name="unique_option_rule_per_contract",
            )
        ]

    def __str__(self):
        return f"{self.contract} - {self.option}"
