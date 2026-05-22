from contracts.models import Contract


def get_contract_stats_payload():
    return {
        "contractsCount": Contract.objects.count(),
        "activeContractsCount": Contract.objects.filter(status=Contract.Status.ACTIVE).count(),
    }
