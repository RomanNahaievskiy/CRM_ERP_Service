from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .services.dashboard_stats import get_contract_stats_payload


@require_GET
def contract_stats(request):
    return JsonResponse(get_contract_stats_payload())
