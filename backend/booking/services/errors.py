# Shared service-layer exception. // Спільний виняток для сервісного шару.
# Сервіси кидають його, коли HTTP-шар повинен повернути контрольовану API-помилку.

class ServiceError(Exception):
    # Stores both the API message and the HTTP status that the view should return.
    # Зберігає як повідомлення API, так і статус HTTP, які має повернути view.
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status
