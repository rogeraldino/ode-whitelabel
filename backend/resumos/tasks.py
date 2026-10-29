# resumos/tasks.py
from celery import shared_task
from django.db import transaction
import logging

from usuario.models import Usuario
from conteudo.models import AnoEscolar, Habilidade
from llm.views import gerar_resumo_disciplinar
from .models import Resumo

logger = logging.getLogger(__name__)

SIGLA_PARA_NIVEL = {"EF": "Fundamental", "EM": "Médio"}

def _resolver_ano_escolar(ano_escolar_str: str) -> AnoEscolar:
    numero_str, sigla = ano_escolar_str.split()
    nivel = SIGLA_PARA_NIVEL[sigla.upper()]
    return AnoEscolar.objects.get(numero_ano=int(numero_str), nivel_ensino=nivel)

@shared_task(bind=True, queue="llm_resumos")
def task_criar_resumo(self, data: dict):
    """
    1) Resolve ano/habilidades/usuário
    2) Gera JSON via LLM
    3) Persiste Resumo (sem usar context=request)
    4) Retorna {status, sucesso, dados: {resumo_uuid}}
    """
    try:
        # ── Usuário
        user_email = data.get("userEmail")
        if not user_email:
            raise Exception("userEmail não fornecido")

        try:
            usuario = Usuario.objects.get(email=user_email)
        except Usuario.DoesNotExist:
            raise Exception(f"Usuário não encontrado: {user_email}")

        # ── Ano
        ano_escolar_str = data.get("anoEscolar")
        if not ano_escolar_str:
            raise ValueError("anoEscolar é obrigatório")
        ano = _resolver_ano_escolar(ano_escolar_str)

        # ── Habilidades (aceita 'habilidades' lista ou 'habilidade' única)
        hab_ids = data.get("habilidades") or data.get("habilidade") or []
        if isinstance(hab_ids, (str, int)):
            hab_ids = [hab_ids]
        habilidades = list(Habilidade.objects.filter(id__in=hab_ids))

        # Se não mandou habilidade, você pode gerar por 'assunto' (opcional).
        if not habilidades and not data.get("assunto"):
            raise ValueError("Nenhuma habilidade válida informada")

        # ── Geração por LLM (usa a 1ª habilidade, igual ao original)
        if habilidades:
            resumo_dict, tokens = gerar_resumo_disciplinar(habilidades[0], ano)
        else:
            resumo_dict, tokens = None, 0  # ou implementar geração por assunto

        if not resumo_dict:
            raise Exception("Falha na geração do resumo")

        # ── Persistência
        with transaction.atomic():
            resumo_obj = Resumo.objects.create(
                usuario=usuario,
                nome_documento=resumo_dict.get("title", "Resumo"),
                json_openai=resumo_dict,
                assunto=data.get("assunto"),
            )
            resumo_obj.habilidades.set(habilidades)

        return {
            "status": "SUCCESS",
            "sucesso": True,
            "dados": {
                "resumo_uuid": str(resumo_obj.uuid),
                "mensagem": "Resumo gerado e salvo com sucesso.",
            },
        }

    except Exception as e:
        logger.exception("[RESUMOS] Erro na task_criar_resumo: %s", e)
        raise
