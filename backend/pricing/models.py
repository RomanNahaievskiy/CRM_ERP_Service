from django.db import models


# PriceList groups commercial prices that can be applied by the pricing resolver.
# Прайс-лист групує ціни, які pricing resolver може застосувати для бронювання.
class PriceList(models.Model):
    class Kind(models.TextChoices):
        RETAIL = "retail", "Retail"
        CONTRACT = "contract", "Contract"

    code = models.SlugField(max_length=64, unique=True)
    title = models.CharField(max_length=160)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.RETAIL)
    currency = models.CharField(max_length=3, default="UAH")
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["kind", "title"]

    def __str__(self):
        return self.title


# Price for a concrete service offering inside a price list.
# Ціна конкретної основної пропозиції послуги в межах прайс-листа.
class ServiceOfferingPrice(models.Model):
    price_list = models.ForeignKey(
        PriceList,
        on_delete=models.CASCADE,
        related_name="service_prices",
    )
    service_offering = models.ForeignKey(
        "booking.ServiceOffering",
        on_delete=models.PROTECT,
        related_name="price_items",
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["price_list", "service_offering"]
        constraints = [
            models.UniqueConstraint(
                fields=["price_list", "service_offering"],
                name="unique_service_offering_price_per_price_list",
            )
        ]

    def __str__(self):
        return f"{self.price_list} - {self.service_offering}"


# Price for an additional option inside a price list.
# Ціна додаткової опції в межах прайс-листа.
class ServiceOptionPrice(models.Model):
    price_list = models.ForeignKey(
        PriceList,
        on_delete=models.CASCADE,
        related_name="option_prices",
    )
    option = models.ForeignKey(
        "booking.ServiceOption",
        on_delete=models.PROTECT,
        related_name="price_items",
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["price_list", "option"]
        constraints = [
            models.UniqueConstraint(
                fields=["price_list", "option"],
                name="unique_service_option_price_per_price_list",
            )
        ]

    def __str__(self):
        return f"{self.price_list} - {self.option}"
