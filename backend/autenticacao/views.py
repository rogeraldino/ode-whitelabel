#backend/autenticacao/views.py
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework.permissions import IsAuthenticated
from rest_framework.permissions import AllowAny # Importe AllowAny
from rest_framework.decorators import permission_classes # Importe this

from usuario.models import Usuario

logger = logging.getLogger(__name__)

@permission_classes([AllowAny])
class CookieLoginView(APIView):
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        user = authenticate(request, username=email, password=password)

        if user is not None:
            primeiro_acesso = user.ultimo_login is None
            # atualiza o campo de ultimo login
            user.ultimo_login = timezone.now()
            # também registra no campo padrão do Django
            user.last_login = user.ultimo_login
            user.save(update_fields=['ultimo_login', 'last_login'])
            serializer = TokenObtainPairSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            tokens = serializer.validated_data

            # Armazena o jti do refresh token como a sessão ativa
            refresh_token = RefreshToken(tokens['refresh'])
            user.session_jti = refresh_token['jti']
            user.save(update_fields=['session_jti'])


            # Dados que serão retornados junto com o token
            perfil = user.perfil
            funcionalidades = []
            componentes = []
            if perfil:
                funcionalidades = list(perfil.funcionalidades.values_list("slug", flat=True))
                componentes = list(perfil.componentes.values_list("slug", flat=True))

            user_data = {
                'id': user.id,
                'nome': user.nome,
                'email': user.email,
                'usuario': user.usuario,
                'plano': user.plano,
                'creditos': user.creditos,
                'criado_em': user.criado_em,
                'primeiro_acesso': primeiro_acesso,  # ← AQUI
                'telefone': user.telefone,
                'funcionalidades': funcionalidades,
                'componentes': componentes,
            }

            logger.success(
                "Usuário autenticado com sucesso: %s (id=%s)", email, user.id
            )

            response = Response({
                'message': 'Login realizado com sucesso',
                'user': user_data,        # <<< Retornando dados do usuário aqui
            }, status=status.HTTP_200_OK)

            response.set_cookie(
                key='access_token',
                value=tokens['access'],
                httponly=True,
                secure=True,  # DESCOMENTE ESTA LINHA EM PRODUÇÃO (HTTPS)!
                samesite='Lax',
                max_age=15 * 60,  # 15 minutos
            )
            response.set_cookie(
                key='refresh_token',
                value=tokens['refresh'],
                httponly=True,
                secure=True,  # DESCOMENTE ESTA LINHA EM PRODUÇÃO (HTTPS)!
                samesite='Lax',
                max_age=4 * 24 * 60 * 60,  # 4 dias
            )
            return response

        logger.warning("Falha na autenticação para o e-mail: %s", email)
        return Response({'error': 'Credenciais inválidas'}, status=status.HTTP_401_UNAUTHORIZED)


class CookieTokenRefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get('refresh_token')
        if not refresh_token:
            logger.warning("Refresh token ausente na requisição.")
            return Response({'error': 'Refresh token ausente'}, status=status.HTTP_401_UNAUTHORIZED)

        if "force_error" in request.data:
            raise TokenError("FORCING TOKEN ERROR FOR DEBUG")

        try:
            refresh = RefreshToken(refresh_token)
            user_id = refresh['user_id']
            user = Usuario.objects.get(id=user_id)

            # Valida o jti
            if str(refresh['jti']) != str(user.session_jti):
                logger.warning("Tentativa de usar refresh token de sessão inválida.")
                raise TokenError("Sessão expirada: jti não corresponde à sessão ativa")

            access_token = RefreshToken.for_user(user).access_token
            access_token['jti'] = refresh['jti']  # Força o jti do access ser igual ao do refresh
            access_token = str(access_token)


            logger.success(
                "Novo access token gerado com sucesso para usuario %s", user.id
            )

            response = Response({'message': 'Novo access token gerado com sucesso.'}, status=status.HTTP_200_OK)
            response.set_cookie(
                key='access_token',
                value=access_token,
                httponly=True,
                secure=True,            # ← marca Secure
                samesite="Lax",         # ou "None" se precisar cross-site; se for "None", mantenha secure=True
                max_age=15 * 60,  # 15 minutos
            )
            return response

        except TokenError:
            logger.error("Token de refresh inválido (TokenError).")
            return Response({'error': 'Token inválido ou expirado'}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            logger.error(f"Erro inesperado ao refrescar token: {e}")
            return Response({'error': 'Erro interno do servidor'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




class LogoutView(APIView):
    def post(self, request):
        logger.info("Usuário %s deslogado.", request.user.id)
        if request.user.is_authenticated:
            request.user.session_jti = None
            request.user.save(update_fields=['session_jti'])
        response = Response({"message": "Logout realizado com sucesso"}, status=status.HTTP_200_OK)
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response


class ProtectedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logger.info(
            "Acesso autorizado ao endpoint protegido por usuario %s", request.user.id
        )
        return Response({'message': 'Você está autenticado!'})
