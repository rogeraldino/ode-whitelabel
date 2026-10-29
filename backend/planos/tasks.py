# planos/tasks.py
from celery import shared_task
from types import SimpleNamespace
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from llm.views import gerar_recursos_e_avaliacao, gerar_plano_estruturado
from atividades.utils import limpar_resposta_openai
from .serializers import PlanoDeAulaSerializer
from .models import PlanoDeAula
from conteudo.models import (
    AnoEscolar, Componente, Habilidade,
    CompetenciaGeral, CompetenciaEspecifica, Metodologia
)
from usuario.models import Usuario
import json
import logging

logger = logging.getLogger(__name__)

@shared_task(bind=True, queue="llm_planos")
def task_criar_plano(self, data: dict):
    """
    Entrada esperada (ids ou valores já normalizados):
      {
        "userEmail": "...",
        "nome" | "titulo": "...",
        "componente": <id>,
        "ano": <id>,
        "habilidade": <id>,
        "competencias_gerais": [ids],
        "competencias_especificas": [ids],
        "metodologia": <id>,
        "observacao": "..."
      }
    Saída:
      { "sucesso": true, "dados": { "plano_uuid": "<uuid>" } }
    """
    try:
        user_email = data.get("userEmail")
        if not user_email:
            raise Exception("userEmail ausente na payload")

        usuario = Usuario.objects.get(email=user_email)

        componente = Componente.objects.get(pk=data.get("componente"))
        ano = AnoEscolar.objects.get(pk=data.get("ano"))
        habilidade = Habilidade.objects.get(pk=data.get("habilidade"))
        cgs = list(CompetenciaGeral.objects.filter(id__in=(data.get("competencias_gerais") or [])))
        ces = list(CompetenciaEspecifica.objects.filter(id__in=(data.get("competencias_especificas") or [])))
        metodologia = Metodologia.objects.filter(pk=data.get("metodologia")).first()
        observacao = data.get("observacao") or ""
        nome_plano = data.get("nome") or data.get("titulo") or "Plano de Aula"

        # Gera plano estruturado com nova função
        resposta_estruturada, _ = gerar_plano_estruturado(
            componente, ano, habilidade, cgs, ces, metodologia, observacao
        )
        if not resposta_estruturada:
            raise Exception("Falha na geração do plano estruturado via LLM")

        resposta_limpa = limpar_resposta_openai(resposta_estruturada)
        try:
            plano_json = json.loads(resposta_limpa)
        except json.JSONDecodeError:
            logger.error("Resposta da LLM não é JSON válido")
            raise

        # Mantém compatibilidade com sistema antigo gerando recursos e avaliação
        resposta_openai, _ = gerar_recursos_e_avaliacao(
            componente, ano, habilidade, cgs, ces, metodologia, observacao
        )
        if resposta_openai:
            resposta_limpa_antiga = limpar_resposta_openai(resposta_openai)
            try:
                resposta_json_antiga = json.loads(resposta_limpa_antiga)
            except json.JSONDecodeError:
                resposta_json_antiga = {"avaliacao": [], "recursos_didaticos": []}
        else:
            resposta_json_antiga = {"avaliacao": [], "recursos_didaticos": []}

        serializer_data = {
            "nome": nome_plano,
            "componente": componente.id,
            "ano": ano.id,
            "habilidade": habilidade.id,
            "competencias_gerais": [c.id for c in cgs],
            "competencias_especificas": [c.id for c in ces],
            "metodologia": metodologia.id if metodologia else None,
            "avaliacao": resposta_json_antiga.get("avaliacao") or [],
            "recursos_didaticos": resposta_json_antiga.get("recursos_didaticos") or [],
            "referencias_bibliograficas": "\n".join(resposta_json_antiga.get("referencias_bibliograficas") or []),
            "observacao": observacao,
            # Novos campos para plano estruturado
            "plano_estruturado": plano_json,
        }

        fake_request = SimpleNamespace(user=usuario)

        with transaction.atomic():
            serializer = PlanoDeAulaSerializer(data=serializer_data, context={"request": fake_request})
            serializer.is_valid(raise_exception=True)
            plano: PlanoDeAula = serializer.save()
            plano.competencias_gerais.set(cgs)
            plano.competencias_especificas.set(ces)

        return {"sucesso": True, "dados": {"plano_uuid": str(plano.uuid)}}

    except ObjectDoesNotExist as e:
        logger.exception("[PLANOS] Objeto relacionado não encontrado: %s", e)
        raise
    except Exception as e:
        logger.exception("[PLANOS] Erro na task_criar_plano: %s", e)
        raise
