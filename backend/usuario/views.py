import logging
import json
import secrets
import string
import os
import re
import hashlib

from django.db import IntegrityError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils import timezone

from .forms import UserCreationForm
from .services import UsuarioService
from usuario.models import Funcionalidade, Perfil, Usuario
from notificacoes.email import enviar_email_boas_vindas
from conteudo.models import Componente
from .serializers import (
    UsuarioAdminSerializer,
    UsuarioCreateUpdateSerializer,
    ComponenteSerializer,
    PerfilSerializer
)
from .permissions import IsAdministradorPermission


logger = logging.getLogger(__name__)


def gerar_senha_aleatoria(tamanho=12):
    caracteres = string.ascii_letters + string.digits
    return ''.join(secrets.choice(caracteres) for _ in range(tamanho))


def gerar_senha_do_email(email):
    """
    Gera senha usando a primeira parte do email (antes do @).
    Ex: 'usuario@exemplo.com' -> 'usuario'
    """
    if not email or '@' not in email:
        # Fallback para senha aleatória se email inválido
        return gerar_senha_aleatoria()
    return email.split('@')[0]


def _token_debug_info(token: str | None) -> dict:
    """
    Retorna informações de debug do token SEM vazar o segredo completo.
    Útil para diagnosticar headers/env em webhooks.
    """
    if token is None:
        return {
            "presente": False,
            "len": 0,
            "prefixo": None,
            "sufixo": None,
            "sha256": None,
        }

    token_str = str(token)
    prefixo = token_str[:4] if len(token_str) >= 4 else token_str
    sufixo = token_str[-4:] if len(token_str) >= 4 else token_str
    sha256 = hashlib.sha256(token_str.encode("utf-8")).hexdigest()
    return {
        "presente": True,
        "len": len(token_str),
        "prefixo": prefixo,
        "sufixo": sufixo,
        "sha256": sha256,
    }

class CriarUsuarioManualView(APIView):
    """
    POST /api/usuarios/criar-manual/
    Header:
        X-Creation-Token: <seu-token>
    Body JSON:
    {
      "nome": "...",
      "email": "...",
      "telefone": "...",
      "plano": "...",
      "tipo_documento": "...",
      "documento": "..."
    }
    """
    authentication_classes = []  # sem autenticação DRF
    permission_classes = []      # sem permissão DRF

    def post(self, request):
        # valida token custom
        token_recebido = request.headers.get("X-Creation-Token")
        token_esperado = os.getenv("MANUAL_CREATION_TOKEN")
        if token_recebido != token_esperado:
            logger.warning("Criação manual rejeitada: token inválido.")
            return Response({
                'status': 'erro',
                'mensagem': 'Token inválido'
            }, status=status.HTTP_200_OK)

        # validação do payload
        form = UserCreationForm(request.data)
        if not form.is_valid():
            logger.warning("Erros de validação na criação manual: %s", form.errors)
            return Response({
                'status': 'erro',
                'mensagem': 'Dados inválidos',
                'detalhes': form.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            dados = form.cleaned_data
            senha = gerar_senha_aleatoria()
            plano = dados.get('plano')
            duracao = PLANOS_PARA_MESES.get(plano, 0)
            usuario = UsuarioService.criar_novo_usuario(
                nome=dados['nome'],
                email=dados['email'],
                usuario=None,
                senha=senha,
                plano=plano,
                tipo_documento=dados.get('tipo_documento'),
                documento=dados.get('documento'),
                telefone=dados.get('telefone'),
                duracao_meses=duracao,
            )

            componentes = request.data.get('componentes', [])
            funcionalidades = request.data.get('funcionalidades', [])
            if isinstance(componentes, str):
                componentes = [componentes]
            if isinstance(funcionalidades, str):
                funcionalidades = [funcionalidades]

            if componentes:
                UsuarioService.vincular_componentes_a_usuarios(componentes, [usuario.id])
                usuario.refresh_from_db()

            if funcionalidades:
                perfil = usuario.perfil
                if perfil is None:
                    perfil = Perfil.objects.create(nome=f"Perfil {usuario.id}")
                    usuario.perfil = perfil
                    usuario.save(update_fields=["perfil"])
                fun_objs = Funcionalidade.objects.filter(slug__in=funcionalidades)
                perfil.funcionalidades.add(*fun_objs)

            enviar_email_boas_vindas(usuario.nome, usuario.email, senha)
            logger.success(
                "Usuário criado manualmente: %s (id=%s)",
                usuario.email,
                usuario.id,
            )
            return Response({
                'status': 'sucesso',
                'mensagem': 'Usuário criado com sucesso!',
                'usuario': {
                    'nome': usuario.nome,
                    'email': usuario.email,
                    'usuario': usuario.usuario,
                    'plano': usuario.plano,
                    'telefone': usuario.telefone,
                }
            }, status=status.HTTP_201_CREATED)

        except Exception:
            logger.exception("Erro interno ao criar usuário manualmente.")
            return Response({
                'status': 'erro',
                'mensagem': 'Erro interno ao criar usuário'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


PLANOS_PARA_MESES = {
    "mensal": 1,
    "semestral": 6,
    "anual": 12,
}

# NOVO: mapeamento dos códigos do item -> plano
CODES_PARA_PLANO = {
    "49602065": "mensal",
    "91730110": "semestral",
    "69057143": "anual",
}

FUNCIONALIDADES_PADRAO = [
    "gerar-atividade",
    "gerar-resumo",
    "gerar-plano-de-aula",
    "corrigir-atividade",
    "baixar-mapa-mental",
]
COMPONENTE_PADRAO = "matematica"


class WebhookDoppusView(APIView):
    authentication_classes = []  # Sem autenticação padrão
    permission_classes = []      # Controle manual

    def post(self, request):
        logger.info(f"HEADERS recebidos: {dict(request.headers)}")

        # ---- Parse body ------------------------------------------------------
        try:
            body_str = request.body.decode('utf-8')
            logger.info(f"BODY recebido: {body_str}")
            body_data = json.loads(body_str)
        except Exception as e:
            logger.warning(f"Erro ao decodificar body: {e}")
            return Response({
                'status': 'erro',
                'mensagem': 'JSON malformado'
            }, status=status.HTTP_200_OK)

        # ---- Autenticação do webhook -----------------------------------------
        token_recebido = request.headers.get('Doppus-Token')
        token_esperado = os.getenv("DOPPUS_WEBHOOK_TOKEN")
        if token_recebido != token_esperado:
            logger.warning("Requisição de webhook rejeitada: token inválido.")
            return Response({
                'status': 'erro',
                'mensagem': 'Token inválido'
            }, status=status.HTTP_200_OK)

        # ---- Verifica status aprovado ----------------------------------------
        status_obj = body_data.get('status', {}) or {}
        status_code = status_obj.get('code')
        if status_code != 'approved':
            logger.info(f"Pagamento não aprovado. status.code={status_code}")
            return Response({
                'status': 'erro',
                'mensagem': 'Pagamento não aprovado'
            }, status=status.HTTP_200_OK)

        # ---- Extrai cliente ---------------------------------------------------
        customer = body_data.get('customer', {}) or {}
        nome = customer.get('name')
        email = customer.get('email')
        telefone = customer.get('phone')
        tipo_documento = (customer.get('doc_type') or '').upper()
        documento = customer.get('doc')

        # ---- Determina plano a partir do items[0].code ------------------------
        items = body_data.get('items') or []
        if not items:
            logger.warning("Webhook sem items.")
            return Response({
                'status': 'erro',
                'mensagem': 'Itens não informados'
            }, status=status.HTTP_200_OK)

        # pega o primeiro item com code válido
        item_code = None
        for it in items:
            c = str(it.get('code') or '').strip()
            if c:
                item_code = c
                break

        if not item_code:
            logger.warning("Item sem code.")
            return Response({
                'status': 'erro',
                'mensagem': 'Código do item ausente'
            }, status=status.HTTP_200_OK)

        plano = CODES_PARA_PLANO.get(item_code)
        if not plano:
            logger.warning(f"Código do item não mapeado: {item_code}")
            return Response({
                'status': 'erro',
                'mensagem': f'Código do item {item_code} não reconhecido'
            }, status=status.HTTP_200_OK)

        duracao = PLANOS_PARA_MESES.get(plano, 0)

        # ---- Valida formulário (mesma regra do endpoint manual) ---------------
        form_data = {
            'nome': nome,
            'email': email,
            'telefone': telefone,
            'tipo_documento': tipo_documento,
            'documento': documento,
            'plano': plano,  # sobrescreve pelo plano derivado do code
        }
        form = UserCreationForm(form_data)
        if not form.is_valid():
            logger.warning("Erros de validação no webhook: %s", form.errors)
            return Response({
                'status': 'erro',
                'mensagem': 'Dados inválidos',
                'detalhes': form.errors,
            }, status=status.HTTP_200_OK)

        # ---- Criação do usuário + permissões ---------------------------------
        try:
            senha = gerar_senha_aleatoria()
            usuario = UsuarioService.criar_novo_usuario(
                nome=nome,
                email=email,
                usuario=None,
                senha=senha,
                plano=plano,
                tipo_documento=tipo_documento,
                documento=documento,
                telefone=telefone,
                duracao_meses=duracao,
            )

            # Garante perfil e vincula funcionalidades + componente matemática
            perfil = usuario.perfil
            if perfil is None:
                perfil = Perfil.objects.create(nome=f"Perfil {usuario.id}")
                usuario.perfil = perfil
                usuario.save(update_fields=["perfil"])

            fun_objs = Funcionalidade.objects.filter(slug__in=FUNCIONALIDADES_PADRAO)
            perfil.funcionalidades.add(*fun_objs)

            # componente matemática
            from conteudo.models import Componente  # evitar import cíclico no topo
            try:
                comp_mate = Componente.objects.get(slug=COMPONENTE_PADRAO)
                perfil.componentes.add(comp_mate)
            except Componente.DoesNotExist:
                logger.warning("Componente 'matematica' não encontrado. Crie via comando de seed.")

            enviar_email_boas_vindas(nome, email, senha)
            logger.success("Usuário criado via webhook Doppus: %s (id=%s)", email, usuario.id)

            return Response({
                'status': 'sucesso',
                'mensagem': 'Usuário criado com sucesso!',
                'usuario': {
                    'nome': usuario.nome,
                    'email': usuario.email,
                    'usuario': usuario.usuario,
                    'plano': usuario.plano,
                    'telefone': usuario.telefone
                }
            }, status=status.HTTP_200_OK)

        except Exception:
            logger.exception("Erro inesperado ao criar usuário.")
            return Response({
                'status': 'erro',
                'mensagem': 'Erro interno ao criar usuário'
            }, status=status.HTTP_200_OK)



class UsuarioLogadoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        logger.info(
            "Dados do usuário autenticado retornados: %s (id=%s)",
            user.email,
            user.id,
        )
        logger.success("Dados do usuário %s retornados com sucesso", user.id)
        if user.expira_em and user.expira_em < timezone.now():
            user.perfil = None
            user.save(update_fields=["perfil"])

        perfil = user.perfil
        funcionalidades = []
        componentes = []
        if perfil:
            funcionalidades = list(perfil.funcionalidades.values_list("slug", flat=True))
            componentes = list(perfil.componentes.values_list("slug", flat=True))
        return Response({
            'nome': user.nome,
            'email': user.email,
            'usuario': user.usuario,
            'primeiro_acesso': user.ultimo_login is None,  # ← aqui
            'telefone': user.telefone,
            'funcionalidades': funcionalidades,
            'componentes': componentes,
        })


class AtualizarCredenciaisView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        novo_usuario = request.data.get('usuario')
        nova_senha = request.data.get('senha')

        if not novo_usuario or not nova_senha:
            return Response({'erro': 'Usuário e senha são obrigatórios'}, status=400)

        try:
            user.usuario = novo_usuario
            user.set_password(nova_senha)
            user.save(update_fields=['usuario', 'password'])
            logger.success(
                "Usuario %s atualizou credenciais com sucesso.", user.id
            )
            return Response({'mensagem': 'Credenciais atualizadas com sucesso'})
        except IntegrityError:
            return Response({'erro': 'Este nome de usuário já está em uso. Por favor, escolha outro.'}, status=400)


class WebhookGuruView(APIView):
    """
    Webhook para receber dados de vendas do Digital Manager Guru
    Processa vendas aprovadas e cria/atualiza usuários com acesso aos componentes.
    """
    authentication_classes = []  # Sem autenticação padrão
    permission_classes = []      # Controle manual

    def post(self, request):
        logger.info(f"Webhook Guru - HEADERS recebidos: {dict(request.headers)}")

        # ---- Parse body ------------------------------------------------------
        try:
            body_str = request.body.decode('utf-8')
            logger.info(f"Webhook Guru - BODY recebido: {body_str}")
            body_data = json.loads(body_str)
        except Exception as e:
            logger.warning(f"Webhook Guru - Erro ao decodificar body: {e}")
            return Response({
                'status': 'erro',
                'mensagem': 'JSON malformado'
            }, status=status.HTTP_200_OK)

        # ---- Autenticação do webhook ----------------------------------------
        api_key_esperada = os.getenv("GURU_WEBHOOK_TOKEN")
        if not api_key_esperada:
            logger.error("Webhook Guru - GURU_WEBHOOK_TOKEN não configurada no ambiente.")
            return Response({
                'status': 'erro',
                'mensagem': 'Configuração de autenticação inválida'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Verifica autenticação via header Authorization ou X-API-Key
        auth_header = request.headers.get('Authorization', '')
        api_key_header = request.headers.get('X-API-Key', '')
        
        # Aceita tanto Bearer token quanto X-API-Key
        token_recebido = None
        if auth_header.startswith('Bearer '):
            token_recebido = auth_header.replace('Bearer ', '')
        elif api_key_header:
            token_recebido = api_key_header
        
        # Se não recebeu token, aceita a requisição (permite webhooks sem autenticação)
        if not token_recebido:
            logger.info("Webhook Guru - Requisição sem token recebida, aceitando...")
        elif token_recebido != api_key_esperada:
            logger.warning(
                "Webhook Guru - Requisição rejeitada: chave API inválida. "
                "Esperado: %s | Recebido: %s",
                api_key_esperada[:20] + "..." if api_key_esperada and len(api_key_esperada) > 20 else api_key_esperada,
                token_recebido[:20] + "..." if token_recebido and len(token_recebido) > 20 else token_recebido
            )
            return Response({
                'status': 'erro',
                'mensagem': 'Chave API inválida'
            }, status=status.HTTP_401_UNAUTHORIZED)
        # ---- Extrai payload --------------------------------------------------
        # Valida se body_data é um dict
        if not isinstance(body_data, dict):
            logger.warning(f"Webhook Guru - body_data não é um dict. Tipo: {type(body_data)}")
            return Response({
                'status': 'erro',
                'mensagem': 'Formato de dados inválido'
            }, status=status.HTTP_200_OK)
        
        # Aceita tanto formato com wrapper {"payload": {...}} quanto sem wrapper {...}
        payload = body_data.get('payload', body_data)
        
        # Valida se payload tem dados (não é None e não é dict vazio)
        if payload is None or (isinstance(payload, dict) and len(payload) == 0):
            logger.warning(
                f"Webhook Guru - Payload vazio. "
                f"body_data keys: {list(body_data.keys()) if isinstance(body_data, dict) else 'N/A'}"
            )
            return Response({
                'status': 'erro',
                'mensagem': 'Payload não encontrado'
            }, status=status.HTTP_200_OK)
        
        # Log para debug: mostra qual formato foi recebido
        if 'payload' in body_data:
            logger.info("Webhook Guru - Formato com wrapper 'payload' detectado")
        else:
            logger.info("Webhook Guru - Formato sem wrapper (dados na raiz) detectado")

        # ---- Verifica status da venda ----------------------------------------
        status_venda = payload.get('status')
        if status_venda != 'approved':
            logger.info(f"Webhook Guru - Venda não aprovada. Status: {status_venda}")
            return Response({
                'status': 'ignorado',
                'mensagem': f'Venda não aprovada. Status: {status_venda}'
            }, status=status.HTTP_200_OK)

        # ---- Extrai dados do contato -----------------------------------------
        contact = payload.get('contact', {})
        if not contact:
            logger.warning("Webhook Guru - Dados do contato não encontrados.")
            return Response({
                'status': 'erro',
                'mensagem': 'Dados do contato não encontrados'
            }, status=status.HTTP_200_OK)

        email = contact.get('email')
        doc = contact.get('doc', '').strip()
        nome = contact.get('name')
        telefone = contact.get('phone_number', '')

        if not email or not nome:
            logger.warning("Webhook Guru - Email ou nome não informados.")
            return Response({
                'status': 'erro',
                'mensagem': 'Email e nome são obrigatórios'
            }, status=status.HTTP_200_OK)

        # ---- Extrai dados do produto -----------------------------------------
        items = payload.get('items', [])
        if not items:
            logger.warning("Webhook Guru - Nenhum item encontrado na venda.")
            return Response({
                'status': 'erro',
                'mensagem': 'Nenhum item encontrado na venda'
            }, status=status.HTTP_200_OK)

        item = items[0]  # Pega o primeiro item
        nome_produto = item.get('name', '')
        meses_acesso = int(item.get('unit_value', 0))

        if not nome_produto:
            logger.warning("Webhook Guru - Nome do produto não informado.")
            return Response({
                'status': 'erro',
                'mensagem': 'Nome do produto não informado'
            }, status=status.HTTP_200_OK)

        if meses_acesso <= 0:
            logger.warning(f"Webhook Guru - Meses de acesso inválido: {meses_acesso}")
            return Response({
                'status': 'erro',
                'mensagem': f'Meses de acesso inválido: {meses_acesso}'
            }, status=status.HTTP_200_OK)

        # ---- Extrai e busca componente ---------------------------------------
        nome_componente = UsuarioService.extrair_componente_do_produto(nome_produto)
        if not nome_componente:
            logger.warning(f"Webhook Guru - Não foi possível extrair componente do produto: {nome_produto}")
            return Response({
                'status': 'erro',
                'mensagem': f'Não foi possível identificar o componente do produto: {nome_produto}'
            }, status=status.HTTP_200_OK)

        componente = UsuarioService.buscar_componente_por_nome(nome_componente)
        if not componente:
            logger.warning(f"Webhook Guru - Componente não encontrado no banco: {nome_componente}")
            return Response({
                'status': 'erro',
                'mensagem': f'Componente "{nome_componente}" não encontrado no sistema'
            }, status=status.HTTP_200_OK)

        logger.info(f"Webhook Guru - Componente identificado: {componente.nome} (slug: {componente.slug})")

        # ---- Detecta tipo de documento ---------------------------------------
        tipo_documento = 'CPF'
        if doc:
            # CPF tem 11 dígitos, CNPJ tem 14
            doc_limpo = re.sub(r'\D', '', doc)
            if len(doc_limpo) == 14:
                tipo_documento = 'CNPJ'
            elif len(doc_limpo) == 11:
                tipo_documento = 'CPF'
            else:
                tipo_documento = 'CPF'  # Default

        # ---- Verifica se usuário existe (apenas por email) -------------------
        usuario = None
        try:
            usuario = Usuario.objects.get(email=email)
            logger.info(f"Webhook Guru - Usuário encontrado por email: {email} (id: {usuario.id})")
        except Usuario.DoesNotExist:
            pass

        # ---- Se usuário não existe: CRIAR -------------------------------------
        if not usuario:
            try:
                senha = gerar_senha_do_email(email)
                usuario = UsuarioService.criar_novo_usuario(
                    nome=nome,
                    email=email,
                    usuario=None,
                    senha=senha,
                    tipo_documento=tipo_documento,
                    documento=doc,
                    telefone=telefone,
                    duracao_meses=meses_acesso,
                )

                # Criar perfil e vincular funcionalidades padrão
                perfil = Perfil.objects.create(nome=f"Perfil {usuario.id}")
                usuario.perfil = perfil
                usuario.save(update_fields=["perfil"])

                # Funcionalidades padrão
                fun_objs = Funcionalidade.objects.filter(slug__in=FUNCIONALIDADES_PADRAO)
                perfil.funcionalidades.add(*fun_objs)

                # Vincular componente
                perfil.componentes.add(componente)

                # Enviar email de boas-vindas
                enviar_email_boas_vindas(nome, email, senha)
                
                logger.success(
                    "Webhook Guru - Usuário criado: %s (id=%s, componente=%s, meses=%s)",
                    email, usuario.id, componente.nome, meses_acesso
                )

                return Response({
                    'status': 'sucesso',
                    'mensagem': 'Usuário criado com sucesso',
                    'acao': 'criado',
                    'usuario_id': usuario.id,
                    'componente': componente.nome,
                    'meses_acesso': meses_acesso
                }, status=status.HTTP_200_OK)

            except Exception as e:
                logger.exception(f"Webhook Guru - Erro ao criar usuário: {e}")
                return Response({
                    'status': 'erro',
                    'mensagem': 'Erro interno ao criar usuário',
                    'erro': str(e)
                }, status=status.HTTP_200_OK)

        # ---- Se usuário já existe: ATUALIZAR ---------------------------------
        else:
            try:
                # Garantir perfil existe (usa get_or_create para evitar duplicação)
                if usuario.perfil is None:
                    perfil, created = Perfil.objects.get_or_create(nome=f"Perfil {usuario.id}")
                    usuario.perfil = perfil
                    usuario.save(update_fields=["perfil"])
                else:
                    perfil = usuario.perfil

                # Adicionar componente ao perfil (se não tiver)
                if componente not in usuario.perfil.componentes.all():
                    usuario.perfil.componentes.add(componente)
                    logger.info(f"Webhook Guru - Componente {componente.nome} adicionado ao perfil do usuário {usuario.id}")

                # Estender acesso
                UsuarioService.estender_acesso_usuario(usuario, meses_acesso)
                
                logger.success(
                    "Webhook Guru - Usuário atualizado: %s (id=%s, componente=%s, meses=%s, expira_em=%s)",
                    email, usuario.id, componente.nome, meses_acesso, usuario.expira_em
                )

                return Response({
                    'status': 'sucesso',
                    'mensagem': 'Acesso do usuário atualizado com sucesso',
                    'acao': 'atualizado',
                    'usuario_id': usuario.id,
                    'componente': componente.nome,
                    'meses_acesso': meses_acesso,
                    'expira_em': usuario.expira_em.isoformat() if usuario.expira_em else None
                }, status=status.HTTP_200_OK)

            except Exception as e:
                logger.exception(f"Webhook Guru - Erro ao atualizar usuário: {e}")
                return Response({
                    'status': 'erro',
                    'mensagem': 'Erro interno ao atualizar usuário',
                    'erro': str(e)
                }, status=status.HTTP_200_OK)


class WebhookLastlinkView(APIView):
    """
    Webhook Lastlink para cadastrar/atualizar usuários a partir do body:
    - Event == "Purchase_Order_Confirmed"
    - Data.Products[0].Name => "[MATEMÁTICA] Assistente de Ensino" (usa conteudo_componente.nome)
    - Data.Purchase.Recurrency => meses de acesso
    - Data.Buyer.Email/Name/PhoneNumber/Document => dados pessoais

    Eventos que revogam acesso (remove componente do perfil e expira o acesso no momento do webhook):
    - Payment_Chargeback
    - Payment_Refund
    - Subscription_Canceled

    Autenticação via:
    - Authorization: Bearer <LASTLINK_WEBHOOK_TOKEN>
      ou
    - X-API-Key: <LASTLINK_WEBHOOK_TOKEN>
    """

    authentication_classes = []  # Sem autenticação padrão
    permission_classes = []      # Controle manual

    def post(self, request):
        # Evita vazar tokens em logs (mantemos debug seguro via _token_debug_info)
        headers_dict = dict(request.headers)
        for k in ["Authorization", "X-API-Key", "X-Lastlink-Token"]:
            if k in headers_dict and headers_dict[k]:
                headers_dict[k] = "***redacted***"
        logger.info("Webhook Lastlink - HEADERS recebidos: %s", headers_dict)

        # ---- Token debug (detalhado, porém seguro) --------------------------
        token_esperado = os.getenv("LASTLINK_WEBHOOK_TOKEN")
        auth_header = request.headers.get("Authorization", "")
        api_key_header = request.headers.get("X-API-Key", "")
        lastlink_token_header = request.headers.get("X-Lastlink-Token", "")

        token_recebido = None
        if auth_header.startswith("Bearer "):
            token_recebido = auth_header.replace("Bearer ", "")
        elif api_key_header:
            token_recebido = api_key_header
        elif lastlink_token_header:
            token_recebido = lastlink_token_header

        logger.info(
            "Webhook Lastlink - Token esperado (debug): %s | Token recebido (debug): %s | auth_header_presente=%s | x_api_key_presente=%s | x_lastlink_token_presente=%s",
            _token_debug_info(token_esperado),
            _token_debug_info(token_recebido),
            bool(auth_header),
            bool(api_key_header),
            bool(lastlink_token_header),
        )

        if not token_esperado or token_recebido != token_esperado:
            logger.warning("Webhook Lastlink - Requisição rejeitada: token inválido.")
            return Response(
                {"status": "erro", "mensagem": "Token inválido"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # ---- Parse body ------------------------------------------------------
        try:
            body_str = request.body.decode("utf-8")
            logger.info("Webhook Lastlink - BODY recebido: %s", body_str)
            body_data = json.loads(body_str)
        except Exception as e:
            logger.warning("Webhook Lastlink - Erro ao decodificar body: %s", e)
            return Response(
                {"status": "erro", "mensagem": "JSON malformado"},
                status=status.HTTP_200_OK,
            )

        # ---- Filtros básicos -------------------------------------------------
        if body_data.get("IsTest") is True:
            return Response(
                {"status": "ignorado", "mensagem": "Evento de teste"},
                status=status.HTTP_200_OK,
            )

        evento = body_data.get("Event")
        EVENTO_COMPRA = "Purchase_Order_Confirmed"
        EVENTOS_REVOGACAO = {"Payment_Chargeback", "Payment_Refund", "Subscription_Canceled"}
        if evento not in ({EVENTO_COMPRA} | EVENTOS_REVOGACAO):
            return Response(
                {"status": "ignorado", "mensagem": f"Evento ignorado: {evento}"},
                status=status.HTTP_200_OK,
            )

        is_revogacao = evento in EVENTOS_REVOGACAO
        data = body_data.get("Data") or {}
        purchase_top = body_data.get("Purchase") or {}

        # ---- Extrai produto --------------------------------------------------
        nome_produto = ""
        products = data.get("Products") or []
        if products:
            nome_produto = (products[0].get("Name") or "").strip()
        if not nome_produto:
            # Formato alternativo (ex.: Payment_Refund / Subscription_Canceled)
            nome_produto = (purchase_top.get("ProductName") or "").strip()
        if not nome_produto:
            return Response(
                {"status": "erro", "mensagem": "Nome do produto ausente"},
                status=status.HTTP_200_OK,
            )

        # ---- Extrai meses (somente compra) ----------------------------------
        meses_acesso = 0
        if evento == EVENTO_COMPRA:
            purchase_data = data.get("Purchase") or {}
            try:
                meses_acesso = int(purchase_data.get("Recurrency") or purchase_top.get("Recurrency") or 0)
            except Exception:
                meses_acesso = 0
            if meses_acesso <= 0:
                return Response(
                    {"status": "erro", "mensagem": "Recurrency inválido"},
                    status=status.HTTP_200_OK,
                )

        # ---- Extrai comprador ------------------------------------------------
        buyer = data.get("Buyer") or {}
        customer = purchase_top.get("Customer") or {}
        email = (buyer.get("Email") or customer.get("Email") or "").strip().lower()
        nome = (buyer.get("Name") or customer.get("Name") or "").strip()
        telefone = (buyer.get("PhoneNumber") or "").strip()
        doc = (buyer.get("Document") or "").strip()

        # Para revogação, só o email é estritamente necessário (nome pode vir vazio)
        if not email or (evento == EVENTO_COMPRA and not nome):
            return Response(
                {"status": "erro", "mensagem": "Email (e Name para compra) são obrigatórios"},
                status=status.HTTP_200_OK,
            )

        doc_limpo = re.sub(r"\D", "", doc)
        telefone_limpo = re.sub(r"\D", "", telefone)

        tipo_documento = "CPF"
        if len(doc_limpo) == 14:
            tipo_documento = "CNPJ"
        elif len(doc_limpo) == 11:
            tipo_documento = "CPF"

        # ---- Resolve componente (pela tag [COMPONENTE]) ----------------------
        m = re.search(r"\[([^\]]+)\]", nome_produto)
        nome_componente = (m.group(1).strip() if m else None) or UsuarioService.extrair_componente_do_produto(nome_produto)
        if not nome_componente:
            return Response(
                {
                    "status": "erro",
                    "mensagem": f"Não foi possível extrair componente de: {nome_produto}",
                },
                status=status.HTTP_200_OK,
            )

        componente = Componente.objects.filter(nome__iexact=nome_componente).first()
        if not componente:
            return Response(
                {
                    "status": "erro",
                    "mensagem": f'Componente "{nome_componente}" não encontrado no sistema',
                },
                status=status.HTTP_200_OK,
            )

        logger.info(
            "Webhook Lastlink - Evento=%s | Componente=%s (slug=%s) | meses=%s | email=%s",
            evento,
            componente.nome,
            componente.slug,
            meses_acesso,
            email,
        )

        # ---- Procura usuário (email, fallback doc) ---------------------------
        usuario = None
        try:
            usuario = Usuario.objects.get(email=email)
            logger.info("Webhook Lastlink - Usuário encontrado por email: %s (id=%s)", email, usuario.id)
        except Usuario.DoesNotExist:
            if doc_limpo:
                try:
                    usuario = Usuario.objects.get(documento=doc_limpo)
                    logger.info("Webhook Lastlink - Usuário encontrado por documento: %s (id=%s)", doc_limpo, usuario.id)
                except Usuario.DoesNotExist:
                    usuario = None

        # ---- Revogação de acesso --------------------------------------------
        if is_revogacao:
            if not usuario:
                logger.warning("Webhook Lastlink - Revogação ignorada: usuário não encontrado (email=%s)", email)
                return Response(
                    {"status": "ignorado", "mensagem": "Usuário não encontrado para revogação"},
                    status=status.HTTP_200_OK,
                )

            try:
                agora = timezone.now()

                # Remove componente do perfil se existir
                if usuario.perfil is not None:
                    if componente in usuario.perfil.componentes.all():
                        usuario.perfil.componentes.remove(componente)
                        logger.info(
                            "Webhook Lastlink - Revogação: componente %s removido do perfil do usuário %s",
                            componente.nome,
                            usuario.id,
                        )
                    else:
                        logger.info(
                            "Webhook Lastlink - Revogação: usuário %s não tinha o componente %s no perfil",
                            usuario.id,
                            componente.slug,
                        )
                else:
                    logger.info("Webhook Lastlink - Revogação: usuário %s não possui perfil (sem remoção de componente)", usuario.id)

                # Expira acesso no momento do webhook (revoga acesso global do usuário)
                usuario.expira_em = agora
                usuario.save(update_fields=["expira_em"])

                logger.success(
                    "Webhook Lastlink - Acesso revogado: email=%s (id=%s, componente=%s, expira_em=%s, evento=%s)",
                    email,
                    usuario.id,
                    componente.nome,
                    usuario.expira_em,
                    evento,
                )

                return Response(
                    {
                        "status": "sucesso",
                        "mensagem": "Acesso revogado com sucesso",
                        "acao": "revogado",
                        "usuario_id": usuario.id,
                        "componente": componente.nome,
                        "expira_em": usuario.expira_em.isoformat() if usuario.expira_em else None,
                        "evento": evento,
                    },
                    status=status.HTTP_200_OK,
                )

            except Exception as e:
                logger.exception("Webhook Lastlink - Erro ao revogar acesso: %s", e)
                return Response(
                    {"status": "erro", "mensagem": "Erro interno ao revogar acesso", "erro": str(e)},
                    status=status.HTTP_200_OK,
                )

        # ---- Se usuário não existe: CRIAR ------------------------------------
        if not usuario:
            try:
                senha = gerar_senha_do_email(email)
                usuario = UsuarioService.criar_novo_usuario(
                    nome=nome,
                    email=email,
                    usuario=None,
                    senha=senha,
                    tipo_documento=tipo_documento,
                    documento=doc_limpo,
                    telefone=telefone_limpo,
                    duracao_meses=meses_acesso,
                )

                perfil = Perfil.objects.create(nome=f"Perfil {usuario.id}")
                usuario.perfil = perfil
                usuario.save(update_fields=["perfil"])

                fun_objs = Funcionalidade.objects.filter(slug__in=FUNCIONALIDADES_PADRAO)
                perfil.funcionalidades.add(*fun_objs)
                perfil.componentes.add(componente)

                enviar_email_boas_vindas(nome, email, senha)

                logger.success(
                    "Webhook Lastlink - Usuário criado: %s (id=%s, componente=%s, meses=%s)",
                    email,
                    usuario.id,
                    componente.nome,
                    meses_acesso,
                )

                return Response(
                    {
                        "status": "sucesso",
                        "mensagem": "Usuário criado com sucesso",
                        "acao": "criado",
                        "usuario_id": usuario.id,
                        "componente": componente.nome,
                        "meses_acesso": meses_acesso,
                    },
                    status=status.HTTP_200_OK,
                )
            except Exception as e:
                logger.exception("Webhook Lastlink - Erro ao criar usuário: %s", e)
                return Response(
                    {"status": "erro", "mensagem": "Erro interno ao criar usuário", "erro": str(e)},
                    status=status.HTTP_200_OK,
                )

        # ---- Se usuário já existe: ATUALIZAR --------------------------------
        try:
            if usuario.perfil is None:
                perfil = Perfil.objects.create(nome=f"Perfil {usuario.id}")
                usuario.perfil = perfil
                usuario.save(update_fields=["perfil"])

            if componente not in usuario.perfil.componentes.all():
                usuario.perfil.componentes.add(componente)
                logger.info(
                    "Webhook Lastlink - Componente %s adicionado ao perfil do usuário %s",
                    componente.nome,
                    usuario.id,
                )

            UsuarioService.estender_acesso_usuario(usuario, meses_acesso)

            logger.success(
                "Webhook Lastlink - Usuário atualizado: %s (id=%s, componente=%s, meses=%s, expira_em=%s)",
                email,
                usuario.id,
                componente.nome,
                meses_acesso,
                usuario.expira_em,
            )

            return Response(
                {
                    "status": "sucesso",
                    "mensagem": "Acesso do usuário atualizado com sucesso",
                    "acao": "atualizado",
                    "usuario_id": usuario.id,
                    "componente": componente.nome,
                    "meses_acesso": meses_acesso,
                    "expira_em": usuario.expira_em.isoformat() if usuario.expira_em else None,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.exception("Webhook Lastlink - Erro ao atualizar usuário: %s", e)
            return Response(
                {"status": "erro", "mensagem": "Erro interno ao atualizar usuário", "erro": str(e)},
                status=status.HTTP_200_OK,
            )


# =========================== VIEWS DE ADMINISTRAÇÃO ===========================

class ListarUsuariosView(APIView):
    """Lista todos os usuários do sistema (apenas administradores)"""
    permission_classes = [IsAuthenticated, IsAdministradorPermission]
    
    def get(self, request):
        try:
            usuarios = Usuario.objects.select_related('perfil').prefetch_related(
                'perfil__funcionalidades', 'perfil__componentes'
            ).all().order_by('-criado_em')
            
            serializer = UsuarioAdminSerializer(usuarios, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Erro ao listar usuários: {e}")
            return Response({
                'erro': 'Erro ao listar usuários',
                'detalhes': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DetalharUsuarioView(APIView):
    """Detalha um usuário específico (apenas administradores)"""
    permission_classes = [IsAuthenticated, IsAdministradorPermission]
    
    def get(self, request, usuario_id):
        try:
            usuario = Usuario.objects.select_related('perfil').prefetch_related(
                'perfil__funcionalidades', 'perfil__componentes'
            ).get(pk=usuario_id)
            
            serializer = UsuarioAdminSerializer(usuario)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Usuario.DoesNotExist:
            return Response({
                'erro': 'Usuário não encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception(f"Erro ao detalhar usuário: {e}")
            return Response({
                'erro': 'Erro ao buscar usuário',
                'detalhes': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CriarUsuarioView(APIView):
    """Cria um novo usuário (apenas administradores)"""
    permission_classes = [IsAuthenticated, IsAdministradorPermission]
    
    def post(self, request):
        try:
            serializer = UsuarioCreateUpdateSerializer(data=request.data)
            if serializer.is_valid():
                usuario = serializer.save()
                logger.info(f"Usuário {usuario.id} criado por administrador {request.user.id}")
                
                response_serializer = UsuarioAdminSerializer(usuario)
                return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception(f"Erro ao criar usuário: {e}")
            return Response({
                'erro': 'Erro ao criar usuário',
                'detalhes': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AtualizarUsuarioView(APIView):
    """Atualiza um usuário existente (apenas administradores)"""
    permission_classes = [IsAuthenticated, IsAdministradorPermission]
    
    def put(self, request, usuario_id):
        try:
            usuario = Usuario.objects.get(pk=usuario_id)
            serializer = UsuarioCreateUpdateSerializer(usuario, data=request.data, partial=True)
            if serializer.is_valid():
                usuario = serializer.save()
                logger.info(f"Usuário {usuario.id} atualizado por administrador {request.user.id}")
                
                response_serializer = UsuarioAdminSerializer(usuario)
                return Response(response_serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Usuario.DoesNotExist:
            return Response({
                'erro': 'Usuário não encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception(f"Erro ao atualizar usuário: {e}")
            return Response({
                'erro': 'Erro ao atualizar usuário',
                'detalhes': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ExcluirUsuarioView(APIView):
    """Exclui um usuário (apenas administradores)"""
    permission_classes = [IsAuthenticated, IsAdministradorPermission]
    
    def delete(self, request, usuario_id):
        try:
            usuario = Usuario.objects.get(pk=usuario_id)
            
            # Não permite excluir a si mesmo
            if usuario.id == request.user.id:
                return Response({
                    'erro': 'Você não pode excluir sua própria conta'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            usuario_id_backup = usuario.id
            usuario.delete()
            logger.info(f"Usuário {usuario_id_backup} excluído por administrador {request.user.id}")
            
            return Response({
                'mensagem': 'Usuário excluído com sucesso'
            }, status=status.HTTP_200_OK)
        except Usuario.DoesNotExist:
            return Response({
                'erro': 'Usuário não encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception(f"Erro ao excluir usuário: {e}")
            return Response({
                'erro': 'Erro ao excluir usuário',
                'detalhes': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GerenciarComponentesUsuarioView(APIView):
    """Adiciona ou remove componentes de um usuário (apenas administradores)"""
    permission_classes = [IsAuthenticated, IsAdministradorPermission]
    
    def post(self, request, usuario_id):
        try:
            usuario = Usuario.objects.get(pk=usuario_id)
            acao = request.data.get('acao')  # 'adicionar' ou 'remover'
            componentes_ids = request.data.get('componentes_ids', [])
            
            if acao not in ['adicionar', 'remover']:
                return Response({
                    'erro': 'Ação inválida. Use "adicionar" ou "remover"'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if not componentes_ids:
                return Response({
                    'erro': 'Lista de componentes não pode estar vazia'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Garantir que o usuário tem perfil
            if not usuario.perfil:
                perfil = Perfil.objects.create(nome=f"Perfil {usuario.id}")
                usuario.perfil = perfil
                usuario.save(update_fields=['perfil'])
            
            componentes = Componente.objects.filter(id__in=componentes_ids)
            
            if acao == 'adicionar':
                usuario.perfil.componentes.add(*componentes)
                logger.info(f"Componentes adicionados ao usuário {usuario.id} por administrador {request.user.id}")
            else:
                usuario.perfil.componentes.remove(*componentes)
                logger.info(f"Componentes removidos do usuário {usuario.id} por administrador {request.user.id}")
            
            response_serializer = UsuarioAdminSerializer(usuario)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
            
        except Usuario.DoesNotExist:
            return Response({
                'erro': 'Usuário não encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception(f"Erro ao gerenciar componentes: {e}")
            return Response({
                'erro': 'Erro ao gerenciar componentes',
                'detalhes': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RedefinirSenhaUsuarioView(APIView):
    """Redefine a senha de um usuário (apenas administradores)"""
    permission_classes = [IsAuthenticated, IsAdministradorPermission]
    
    def post(self, request, usuario_id):
        try:
            usuario = Usuario.objects.get(pk=usuario_id)
            nova_senha = request.data.get('nova_senha')
            
            if not nova_senha:
                return Response({
                    'erro': 'Nova senha é obrigatória'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if len(nova_senha) < 6:
                return Response({
                    'erro': 'A senha deve ter no mínimo 6 caracteres'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            usuario.set_password(nova_senha)
            usuario.save(update_fields=['password'])
            
            logger.info(f"Senha do usuário {usuario.id} redefinida por administrador {request.user.id}")
            
            return Response({
                'mensagem': 'Senha redefinida com sucesso'
            }, status=status.HTTP_200_OK)
            
        except Usuario.DoesNotExist:
            return Response({
                'erro': 'Usuário não encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception(f"Erro ao redefinir senha: {e}")
            return Response({
                'erro': 'Erro ao redefinir senha',
                'detalhes': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ListarPerfisView(APIView):
    """Lista todos os perfis disponíveis (apenas administradores)"""
    permission_classes = [IsAuthenticated, IsAdministradorPermission]
    
    def get(self, request):
        try:
            perfis = Perfil.objects.prefetch_related('funcionalidades', 'componentes').all()
            serializer = PerfilSerializer(perfis, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Erro ao listar perfis: {e}")
            return Response({
                'erro': 'Erro ao listar perfis',
                'detalhes': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ListarComponentesView(APIView):
    """Lista todos os componentes disponíveis (apenas administradores)"""
    permission_classes = [IsAuthenticated, IsAdministradorPermission]
    
    def get(self, request):
        try:
            componentes = Componente.objects.all().order_by('nome')
            serializer = ComponenteSerializer(componentes, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Erro ao listar componentes: {e}")
            return Response({
                'erro': 'Erro ao listar componentes',
                'detalhes': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdicionarMesesAcessoView(APIView):
    """Adiciona meses de acesso a um usuário (apenas administradores)"""
    permission_classes = [IsAuthenticated, IsAdministradorPermission]
    
    def post(self, request, usuario_id):
        try:
            usuario = Usuario.objects.get(pk=usuario_id)
            meses = request.data.get('meses')
            
            if not meses:
                return Response({
                    'erro': 'Quantidade de meses é obrigatória'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                meses = int(meses)
            except (ValueError, TypeError):
                return Response({
                    'erro': 'Quantidade de meses deve ser um número inteiro'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if meses <= 0:
                return Response({
                    'erro': 'Quantidade de meses deve ser maior que zero'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Usa o método do serviço para estender acesso
            UsuarioService.estender_acesso_usuario(usuario, meses)
            
            # Recarrega o usuário para pegar a data atualizada
            usuario.refresh_from_db()
            
            logger.info(
                f"Meses de acesso adicionados ao usuário {usuario.id} por administrador {request.user.id}. "
                f"Meses: {meses}, Nova data de expiração: {usuario.expira_em}"
            )
            
            response_serializer = UsuarioAdminSerializer(usuario)
            return Response({
                'mensagem': f'{meses} meses de acesso adicionados com sucesso',
                'usuario': response_serializer.data,
                'nova_data_expiracao': usuario.expira_em.isoformat() if usuario.expira_em else None
            }, status=status.HTTP_200_OK)
            
        except Usuario.DoesNotExist:
            return Response({
                'erro': 'Usuário não encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception(f"Erro ao adicionar meses de acesso: {e}")
            return Response({
                'erro': 'Erro ao adicionar meses de acesso',
                'detalhes': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

