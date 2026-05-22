import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from booking.services.errors import ServiceError

from .services import resolve_pricing_terms


@csrf_exempt
@require_POST
def resolve_pricing(request):
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    try:
        return JsonResponse(resolve_pricing_terms(payload))
    except ServiceError as exc:
        return JsonResponse({"error": exc.message}, status=exc.status)
