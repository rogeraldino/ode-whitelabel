from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from usuario.permissions import perfil_perm
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
import json
import logging

from .models import PlanoDeAula
from conteudo.models import (
    AnoEscolar,
    Componente,
    Habilidade,
    CompetenciaGeral,
    CompetenciaEspecifica,
    Metodologia,
)
from .serializers import PlanoDeAulaSerializer
from llm.views import gerar_recursos_e_avaliacao
from atividades.utils import limpar_resposta_openai
from docxgenerator.utils import gerar_docx_plano, gerar_docx_plano_estruturado
from planos.tasks import task_criar_plano  # novo


logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def meus_planos(request):
    """Lista planos de aula criados pelo usuário autenticado."""
    archived = request.GET.get("archived", "false").lower() == "true"
    planos = (
        PlanoDeAula.objects
        .filter(usuario=request.user, arquivado=archived)
        .prefetch_related("competencias_gerais", "competencias_especificas")
        .order_by("-criado_em")
    )
    serializer = PlanoDeAulaSerializer(planos, many=True)
    return Response(serializer.data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def arquivar_plano(request, plano_uuid):
    try:
        plano = PlanoDeAula.objects.get(uuid=plano_uuid, usuario=request.user)
        plano.arquivado = True
        plano.save(update_fields=["arquivado"])
        return Response({"mensagem": "Plano arquivado."}, status=status.HTTP_200_OK)
    except PlanoDeAula.DoesNotExist:
        return Response({"detail": "Plano não encontrado."}, status=status.HTTP_404_NOT_FOUND)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def desarquivar_plano(request, plano_uuid):
    """Restaura um plano arquivado."""
    try:
        plano = PlanoDeAula.objects.get(uuid=plano_uuid, usuario=request.user)
        plano.arquivado = False
        plano.save(update_fields=["arquivado"])
        return Response({"mensagem": "Plano desarquivado."}, status=status.HTTP_200_OK)
    except PlanoDeAula.DoesNotExist:
        return Response({"detail": "Plano não encontrado."}, status=status.HTTP_404_NOT_FOUND)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def deletar_plano(request, plano_uuid):
    try:
        plano = PlanoDeAula.objects.get(uuid=plano_uuid, usuario=request.user)
        plano.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except PlanoDeAula.DoesNotExist:
        return Response({"detail": "Plano não encontrado."}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def baixar_plano(request, plano_uuid):
    try:
        plano = (
            PlanoDeAula.objects
            .select_related("habilidade", "ano", "componente")
            .prefetch_related("competencias_gerais", "competencias_especificas")
            .get(uuid=plano_uuid, usuario=request.user)
        )
    except PlanoDeAula.DoesNotExist:
        return Response({"detail": "Plano não encontrado."}, status=status.HTTP_404_NOT_FOUND)

    # Listas legíveis de CGs / CEs
    cg_list = [f"{c.numero} - {c.descricao}" for c in plano.competencias_gerais.all()]
    ce_list = [f"{c.numero} - {c.descricao}" for c in plano.competencias_especificas.all()]

    # Ano / Turma e Componente no formato esperado pelo gerador DOCX
    ano_turma = f"{plano.ano.numero_ano}º ano do Ensino {plano.ano.nivel_ensino}"
    componente_nome = plano.componente.nome

    # Referências como lista (cada linha vira um bullet)
    refs_lista = (
        plano.referencias_bibliograficas.split("\n")
        if plano.referencias_bibliograficas else []
    )

    final_json = {
        "Sequência": "",  # Preencha se você armazenar este campo no modelo
        "Ano / Turma": ano_turma,
        "Componentes Curriculares": componente_nome,
        "Competências gerais": cg_list,
        "Competências específicas": ce_list,
        "Unidade Temática": (
            plano.habilidade.unidade_tematica.nome
            if plano.habilidade and plano.habilidade.unidade_tematica else ""
        ),
        "Habilidade BNCC": (
            f"{plano.habilidade.codigo_bncc} - {plano.habilidade.descricao}"
            if plano.habilidade else ""
        ),
        "Objeto de conhecimento": (
            plano.habilidade.objeto_conhecimento.descricao
            if plano.habilidade and plano.habilidade.objeto_conhecimento else ""
        ),
        "Tipo da metodologia e descrição da metodologia": (
            f"({plano.metodologia.tipo}) {plano.metodologia.nome} - {plano.metodologia.definicao}"
            if plano.metodologia else ""
        ),
        # Incluído para o gerador (se existir no seu modelo)
        "Objetivos": getattr(plano, "objetivos", "") or "",
        "Recursos didáticos": plano.recursos_didaticos,
        "Avaliação": plano.avaliacao,
        # Observação não é usada pelo gerador atual, mas mantemos
        "Observação": plano.observacao or "",
        "Referências bibliográficas": refs_lista,
    }

    # Verifica se existe plano estruturado para usar o novo gerador
    plano_estruturado = plano.plano_estruturado
    if plano_estruturado and isinstance(plano_estruturado, dict):
        buffer = gerar_docx_plano_estruturado(plano_estruturado, plano.nome)
    else:
        # Fallback para o gerador antigo
        buffer = gerar_docx_plano(final_json, plano.nome)
    
    response = HttpResponse(
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    response["Content-Disposition"] = f'attachment; filename="plano_{plano.uuid}.docx"'
    return response



@api_view(['POST'])
@permission_classes([IsAuthenticated, perfil_perm("gerar-plano-de-aula")])
def criar_plano(request):
    data = request.data.copy()
    data.setdefault("userEmail", getattr(request.user, "email", None))

    # Normaliza anoEscolar → id (mesma lógica que você já tem)
    if "ano" not in data and data.get("anoEscolar"):
        try:
            numero, sigla = data["anoEscolar"].split()
            nivel = {"EF": "Fundamental", "EM": "Médio"}[sigla.upper()]
            from conteudo.models import AnoEscolar
            ano_obj = AnoEscolar.objects.get(numero_ano=int(numero), nivel_ensino=nivel)
            data["ano"] = ano_obj.id
        except Exception:
            return Response({"anoEscolar": "Valor inválido"}, status=status.HTTP_400_BAD_REQUEST)

    # dispara Celery
    task = task_criar_plano.delay(data)
    return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)