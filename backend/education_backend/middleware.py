import json
import logging
import time
from typing import Optional

from autenticacao.authentication import CookieJWTAuthentication

from django.http import HttpRequest, HttpResponse


logger = logging.getLogger("education_backend")


class RequestLogMiddleware:
    """Loga início e fim de cada requisição no padrão esperado."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_auth = CookieJWTAuthentication()

    def __call__(self, request: HttpRequest) -> HttpResponse:
        start = time.monotonic()

        user_email: Optional[str] = None
        if hasattr(request, "user") and request.user.is_authenticated:
            user_email = request.user.email
        else:
            auth_result = self.jwt_auth.authenticate(request)
            if auth_result:
                request.user = auth_result[0]
                user_email = request.user.email

        logger.info(
            json.dumps(
                {
                    "event": "request_started",
                    "method": request.method,
                    "path": request.path,
                    "user_email": user_email,
                    "msg": "request received",
                }
            )
        )

        response = self.get_response(request)

        latency_ms = int((time.monotonic() - start) * 1000)

        logger.info(
            json.dumps(
                {
                    "event": "request_finished",
                    "method": request.method,
                    "path": request.path,
                    "status": response.status_code,
                    "latency_ms": latency_ms,
                    "user_email": user_email,
                    "msg": "request finished",
                }
            )
        )

        return response