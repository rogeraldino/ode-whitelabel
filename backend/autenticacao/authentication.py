# autenticacao/authentication.py
import logging
from rest_framework_simplejwt.authentication import JWTAuthentication

logger = logging.getLogger(__name__)

class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get('access_token')
        if raw_token is None:
            logger.debug("access_token não encontrado nos cookies.")
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)

            # Valida se o jti do access token ainda corresponde à sessão ativa
            if str(validated_token['jti']) != str(user.session_jti):
                logger.warning("Token de acesso rejeitado: jti não corresponde à sessão ativa")
                return None

            logger.info("access_token validado e jti confirmado.")
            return user, validated_token
        except Exception as e:
            logger.warning("Falha ao validar o token: %s", str(e))
            return None
