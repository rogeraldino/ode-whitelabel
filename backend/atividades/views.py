# atividades/views.py
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from usuario.permissions import perfil_perm
from rest_framework.response import Response
from rest_framework import status
import json
import logging
from django.db.models import Q
from django.db import transaction

from pdfgenerator.models import ModeloAtividade

# atividades/views.py
from atividades.tasks import task_criar_lista

from .models import Questao, ListaAtividade, Alternativa
from .serializers import QuestaoSerializer, ListaAtividadeSerializer

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. Minhas listas -----------------------------------------------------------
# ---------------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def minhas_listas(request):
    listas = (
        ListaAtividade.objects
        .filter(usuario=request.user)
        .exclude(status="excluida")
        .prefetch_related('habilidades')
        .order_by('-criado_em')
    )
    serializer = ListaAtividadeSerializer(listas, many=True)
    logger.success(
        "Usuario %s: Listas recuperadas com sucesso (%d itens)",
        request.user.id,
        len(serializer.data),
    )
    return Response(serializer.data)


# ---------------------------------------------------------------------------
# 1.1. Deletar lista --------------------------------------------------------
# ---------------------------------------------------------------------------
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def deletar_lista(request, lista_uuid):
    try:
        lista = ListaAtividade.objects.get(uuid=lista_uuid, usuario=request.user)
        lista.delete()
        logger.success(
            "Usuario %s: Lista %s excluida pelo usuário",  request.user.id, lista_uuid
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
    except ListaAtividade.DoesNotExist:
        logger.error(
            "Usuario %s: Tentativa de excluir lista inexistente %s",
            request.user.id,
            lista_uuid,
        )
        return Response({"detail": "Lista não encontrada."}, status=status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# 1.2. Buscar listas inteligentes -------------------------------------------
# ---------------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def buscar_listas(request):
    """Busca inteligente de listas do usuário por nome.

    Parâmetros:
      - q: termo de busca (opcional)
      - archived: se "true", retorna apenas listas arquivadas

    Por padrão, são retornadas listas com status "salva" ou "criada"
    (rascunho).
    """
    termo = request.GET.get("q", "").strip()
    archived = request.GET.get("archived", "false").lower() == "true"

    if archived:
        status_list = ["arquivada"]
    else:
        # Inclui listas ainda não salvas (status "criada") além das salvas.
        # O status "rascunho" é mantido por compatibilidade caso exista.
        status_list = ["salva", "criada", "rascunho"]

    listas = ListaAtividade.objects.filter(usuario=request.user, status__in=status_list)

    if termo:
        listas = listas.filter(nome__icontains=termo)

    serializer = ListaAtividadeSerializer(listas, many=True)
    logger.success(
        "Usuario %s: Busca de listas realizada pelo usuário retornou %d resultados",
        request.user.id,
        len(serializer.data),
    )
    return Response(serializer.data)


# ---------------------------------------------------------------------------
# 1.3. Arquivar lista -------------------------------------------------------
# ---------------------------------------------------------------------------
@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def arquivar_lista(request, lista_uuid):
    try:
        lista = ListaAtividade.objects.get(uuid=lista_uuid, usuario=request.user)
        lista.status = "arquivada"
        lista.save(update_fields=["status"])
        logger.success(
            "Usuario %s: Lista %s arquivada pelo usuário", request.user.id, lista_uuid
        )
        return Response({"mensagem": "Lista arquivada com sucesso."}, status=status.HTTP_200_OK)
    except ListaAtividade.DoesNotExist:
        logger.error(
            "Usuario %s: Tentativa de arquivar lista inexistente %s pelo usuario",
            request.user.id,
            lista_uuid,
        )
        return Response({"erro": "Lista não encontrada."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error("Usuário %s: Erro ao arquivar lista %s pelo usuário: %s", request.user.id, lista_uuid, e)
        return Response({"erro": str(e)}, status=status.HTTP_400_BAD_REQUEST)

# ---------------------------------------------------------------------------
# 1.4. Desarquivar lista -----------------------------------------------------
# ---------------------------------------------------------------------------
@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def desarquivar_lista(request, lista_uuid):
    try:
        lista = ListaAtividade.objects.get(uuid=lista_uuid, usuario=request.user)
        lista.status = "salva"
        lista.save(update_fields=["status"])
        logger.success(
            "Usuario %s: Lista %s desarquivada pelo usuário", request.user.id, lista_uuid
        )
        return Response({"mensagem": "Lista desarquivada com sucesso."}, status=status.HTTP_200_OK)
    except ListaAtividade.DoesNotExist:
        logger.error(
            "Usuario %s: Tentativa de desarquivar lista inexistente %s pelo usuario",
            request.user.id,
            lista_uuid,
        )
        return Response({"erro": "Lista não encontrada."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error("Usuário %s: Erro ao desarquivar lista %s pelo usuário: %s", request.user.id, lista_uuid, e)
        return Response({"erro": str(e)}, status=status.HTTP_400_BAD_REQUEST)

# ---------------------------------------------------------------------------
# 2. Salvar lista (sincronizar questões) -------------------------------------
# ---------------------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def salvar_lista(request):
    """
    Espera payload com pesos opcionais:
    {
      "listaUuid": <uuid>,
      "questoes": { "id": peso, ... } ou [id1, id2, ...]
    }
    """
    lista_uuid = request.data.get("listaUuid")
    questoes_payload = request.data.get("questoes", [])

    if not lista_uuid:
        return Response(
            {"detail": "listaUuid obrigatório."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    pesos = {}
    if isinstance(questoes_payload, dict):
        try:
            pesos = {q_uuid: float(v) for q_uuid, v in questoes_payload.items()}
        except ValueError:
            return Response({"detail": "UUIDs ou pesos inválidos."}, status=400)
        questoes_uuids = list(pesos.keys())
    elif isinstance(questoes_payload, list):
        questoes_uuids = list(questoes_payload)
        pesos = {u: 1.0 for u in questoes_uuids}
    else:
        return Response({"detail": "Formato de 'questoes' inválido."}, status=400)

    try:
        lista = ListaAtividade.objects.get(uuid=lista_uuid, usuario=request.user)
    except ListaAtividade.DoesNotExist:
        return Response({"detail": "Lista não encontrada."}, status=status.HTTP_404_NOT_FOUND)

    # Conjuntos de ids
    atuais = set(lista.questoes.values_list("id", flat=True))
    novos = set(
        Questao.objects.filter(uuid__in=questoes_uuids).values_list("id", flat=True)
    )

    # Adicionar e remover conforme necessário
    adicionar = novos - atuais
    remover = atuais - novos

    if adicionar:
        questoes_add = Questao.objects.filter(id__in=adicionar)
        lista.questoes.add(*questoes_add)
    if remover:
        questoes_rem = Questao.objects.filter(id__in=remover)
        lista.questoes.remove(*questoes_rem)

    # Atualiza quantidade e status
    lista.quantidade_questoes = lista.questoes.count()
    lista.status = "salva"
    lista.save(update_fields=["quantidade_questoes", "status"])

    # Cria um registro de modelo de atividades sem gerar PDF
    from pdfgenerator.utils import _create_models_in_db
    questoes_validas = []
    for q_uuid in questoes_uuids:
        try:
            q_obj = Questao.objects.get(uuid=q_uuid)
            questoes_validas.append((q_obj, pesos.get(q_uuid, 1.0)))
        except Questao.DoesNotExist:
            continue

    modelo = _create_models_in_db(
        lista,
        questoes_validas,
        list(Questao.objects.filter(uuid__in=questoes_uuids).values_list("id", flat=True))
    )
    logger.success(
        "Usuário %s: Lista %s salva com %d questoes.",
        request.user.id,
        lista_uuid,
        len(questoes_uuids),
    )
    return Response(
        {
            "success": True,
            "modelo_id": modelo.id,
            "atual": list(lista.questoes.values_list("uuid", flat=True)),
            "adicionadas": list(
                Questao.objects.filter(id__in=adicionar).values_list("uuid", flat=True)
            ),
            "removidas": list(
                Questao.objects.filter(id__in=remover).values_list("uuid", flat=True)
            ),
        },
        status=200,
    )


# ---------------------------------------------------------------------------
# 3. Criar lista de atividades ----------------------------------------------
# ---------------------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated, perfil_perm("gerar-atividade")])
def criar_lista(request):
    data = request.data if isinstance(request.data, dict) else json.loads(request.body.decode("utf-8"))
    data.setdefault("userId", request.user.id)
    data.setdefault("userEmail", getattr(request.user, "email", None))

    # dispara a task no Celery
    task = task_criar_lista.delay(data)
    return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)


# ---------------------------------------------------------------------------
# 4. Questões de uma lista ---------------------------------------------------
# ---------------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def questoes_da_lista(request, uuid_lista):
    try:
        lista = ListaAtividade.objects.get(uuid=uuid_lista)
        questoes = lista.questoes.all()
        serializer = QuestaoSerializer(questoes, many=True)
        logger.success(
            "Usuario %s listou questoes da lista %s", request.user.id, uuid_lista
        )
        return Response({
            "nome": lista.nome,
            "questoes": serializer.data,
        }, status=status.HTTP_200_OK)

    except ListaAtividade.DoesNotExist:
        return Response({"erro": "Lista não encontrada"}, status=status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# 5. Atualizar questão (conteúdo + alternativas) ----------------------------
# ---------------------------------------------------------------------------
@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def atualizar_questao(request, id):
    try:
        questao = Questao.objects.get(uuid=id)
        data = json.loads(request.body.decode("utf-8"))

        # Atualiza campos básicos
        questao.enunciado = data.get("enunciado", questao.enunciado)
        if "resposta_discursiva" in data:
            questao.resposta_discursiva = data["resposta_discursiva"]
        questao.save()

        # Alternativas (estratégia: zera e recria)
        if "alternativas" in data and isinstance(data["alternativas"], list):
            Alternativa.objects.filter(questao=questao).delete()
            for alt in data["alternativas"]:
                Alternativa.objects.create(
                    questao=questao,
                    texto=alt["texto"],
                    letra=alt["letra"],
                    correta=alt["correta"],
                    imagem=alt.get("imagem"),
                )

        # Serializa alternativas novas
        alternativas_novas = Alternativa.objects.filter(questao=questao).order_by("letra")
        alternativas_serializadas = [
            {
                "id": alt.id,
                "letra": alt.letra,
                "texto": alt.texto,
                "correta": alt.correta,
                "imagem": alt.imagem,
            }
            for alt in alternativas_novas
        ]

        logger.success(
            "Usuário %s: Questao %s atualizada pelo usuario", request.user.id, id
        )
        return Response(
            {
                "mensagem": "Questão atualizada com sucesso",
                "questao": {
                    "uuid": str(questao.uuid),
                    "enunciado": questao.enunciado,
                    "tipo": questao.tipo,
                    "resposta_discursiva": questao.resposta_discursiva,
                    "alternativas": alternativas_serializadas,
                    "listas_atividade": [str(lista.uuid) for lista in questao.listas.all()],
                },
            },
            status=status.HTTP_200_OK,
        )
    except Questao.DoesNotExist:
        return Response({"erro": "Questão não encontrada"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"erro": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def buscar_questoes_gerais(request):
    """
    Devolve até 5 questões que não estejam na lista atual.
    - Se a lista tiver BNCC (habilidades), recomenda por mesmas habilidades.
    - Se for tema livre (sem habilidades), recomenda por componente/ano da lista.
    """
    try:
        lista_uuid = request.query_params.get("lista_uuid")
        if not lista_uuid:
            return Response([], status=status.HTTP_200_OK)

        try:
            lista = (
                ListaAtividade.objects
                .select_related("componente", "ano")
                .prefetch_related("habilidades")
                .get(uuid=lista_uuid, usuario=request.user)
            )
        except ListaAtividade.DoesNotExist:
            return Response([], status=status.HTTP_200_OK)

        # IDs das questões já na lista (para excluir)
        questoes_para_excluir_ids = list(
            lista.questoes.values_list("id", flat=True)
        )

        # 1) Caminho BNCC (mesmo comportamento antigo)
        habilidade_ids = list(lista.habilidades.values_list("id", flat=True))
        if habilidade_ids:
            qs = (
                Questao.objects.exclude(id__in=questoes_para_excluir_ids)
                .filter(habilidade_id__in=habilidade_ids)
                .order_by("?")[:5]
            )
        else:
            # 2) Caminho Tema Livre — usa componente/ano da lista
            qs = Questao.objects.exclude(id__in=questoes_para_excluir_ids)
            # filtra por componente/ano DA QUESTÃO, via FK da habilidade (quando existir)
            # para tema livre, a questão pode ter habilidade=None; então combinamos OR
            filtros = Q()
            if lista.componente:
                filtros |= Q(habilidade__componente=lista.componente) | Q(habilidade__isnull=True)
            if lista.ano:
                filtros &= (Q(habilidade__ano=lista.ano) | Q(habilidade__isnull=True))

            # Se não há componente/ano na lista, devolvemos algo genérico (mantendo exclusão)
            if filtros:
                qs = qs.filter(filtros)

            qs = qs.order_by("?")[:5]

        serializer = QuestaoSerializer(qs, many=True)
        logger.success(
            "Usuario %s recebeu %d questoes gerais para lista %s",
            request.user.id, len(serializer.data), lista_uuid,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Exception as e:
        logger.exception("Erro ao buscar questões gerais: %s", e)
        return Response(
            {"erro": f"Ocorreu um erro ao buscar questões gerais: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ---------------------------------------------------------------------------
# 7. Apagar lista ------------------------------------------------------------
# ---------------------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def apagar_lista(request, lista_uuid):
    try:
        lista = ListaAtividade.objects.get(uuid=lista_uuid, usuario=request.user)
        with transaction.atomic():
            ModeloAtividade.objects.filter(lista_atividade=lista).delete()
            lista.status = "excluida"
            lista.save(update_fields=["status"])
        logger.success(
            "Usuário %s: Lista %s apagada pelo usuario", request.user.id, lista_uuid
        )
        return Response({"success": True}, status=status.HTTP_200_OK)
    except ListaAtividade.DoesNotExist:
        logger.error(
            "Usuario %s: Tentativa de apagar lista inexistente %s pelo usuário",
            request.user.id,
            lista_uuid,
        )
        return Response({"detail": "Lista não encontrada"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(
            "Erro ao apagar lista %s pelo usuario %s: %s",
            lista_uuid,
            request.user.id,
            e,
        )
        return Response({"erro": str(e)}, status=status.HTTP_400_BAD_REQUEST)
