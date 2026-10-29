# backend/resumos/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from usuario.permissions import perfil_perm
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
import logging

from conteudo.models import AnoEscolar, Habilidade
from .models import Resumo
from llm.views import gerar_resumo_disciplinar
from docxgenerator.utils import gerar_docx_resumo
from .serializers import ResumoSerializer
from resumos.tasks import task_criar_resumo


logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def meus_resumos(request):
    """Lista resumos criados pelo usuário autenticado."""
    archived = request.GET.get("archived", "false").lower() == "true"
    resumos = (
        Resumo.objects
        .filter(usuario=request.user, arquivado=archived)
        .prefetch_related("habilidades")
        .order_by("-criado_em")
    )
    serializer = ResumoSerializer(resumos, many=True)
    return Response(serializer.data)



@api_view(["POST"])
@permission_classes([IsAuthenticated, perfil_perm("gerar-resumo")])
def criar_resumo(request):
    data = request.data if isinstance(request.data, dict) else {}
    data.setdefault("userEmail", getattr(request.user, "email", None))

    # Validação leve — sem consultas profundas aqui
    if not data.get("anoEscolar") or not data.get("componente"):
        return Response({"detail": "Campos obrigatórios: anoEscolar, componente."}, status=400)

    task = task_criar_resumo.delay(data)
    return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def arquivar_resumo(request, resumo_uuid):
    try:
        resumo = Resumo.objects.get(uuid=resumo_uuid, usuario=request.user)
        resumo.arquivado = True
        resumo.save(update_fields=["arquivado"])
        return Response({"mensagem": "Resumo arquivado."}, status=status.HTTP_200_OK)
    except Resumo.DoesNotExist:
        return Response({"detail": "Resumo não encontrado."}, status=status.HTTP_404_NOT_FOUND)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def desarquivar_resumo(request, resumo_uuid):
    """Restaura um resumo arquivado."""
    try:
        resumo = Resumo.objects.get(uuid=resumo_uuid, usuario=request.user)
        resumo.arquivado = False
        resumo.save(update_fields=["arquivado"])
        return Response({"mensagem": "Resumo desarquivado."}, status=status.HTTP_200_OK)
    except Resumo.DoesNotExist:
        return Response({"detail": "Resumo não encontrado."}, status=status.HTTP_404_NOT_FOUND)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def deletar_resumo(request, resumo_uuid):
    try:
        resumo = Resumo.objects.get(uuid=resumo_uuid, usuario=request.user)
        resumo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except Resumo.DoesNotExist:
        return Response({"detail": "Resumo não encontrado."}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def baixar_resumo(request, resumo_uuid):
    try:
        resumo = Resumo.objects.get(uuid=resumo_uuid, usuario=request.user)
    except Resumo.DoesNotExist:
        return Response({"detail": "Resumo não encontrado."}, status=status.HTTP_404_NOT_FOUND)

    buffer = gerar_docx_resumo(resumo.json_openai, request.user)
    response = HttpResponse(
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    response["Content-Disposition"] = f'attachment; filename="{resumo.nome_documento}.docx"'
    return response
