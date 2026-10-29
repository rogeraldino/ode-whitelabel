from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
import logging
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
from .models import Habilidade, MapaMental
from .serializers import HabilidadeSerializer, MapaMentalSerializer
from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from django.http import FileResponse, Http404
from django.views.decorators.clickjacking import xframe_options_exempt
from django.utils.decorators import method_decorator
from django.conf import settings
from django.db.models import Q
import os
from rest_framework.decorators import api_view, permission_classes
from .models import (
    Habilidade,
    Componente,
    AnoEscolar,
    CompetenciaGeral,
    CompetenciaEspecifica,
    Metodologia,
)
from .serializers import (
    HabilidadeSerializer,
    ComponenteSerializer,
    AnoEscolarSerializer,
    CompetenciaGeralSerializer,
    CompetenciaEspecificaSerializer,
    MetodologiaSerializer,
)

logger = logging.getLogger(__name__)


class ListarHabilidadesBNCC(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        search_term = request.query_params.get("search")
        ano_escolar_id = request.query_params.get("ano_escolar")
        componente_id = request.query_params.get("componente")

        habilidades = Habilidade.objects.all().select_related(
            "componente",
            "ano",
            "unidade_tematica",
            "objeto_conhecimento",
        )

        if ano_escolar_id:
            habilidades = habilidades.filter(ano__id=ano_escolar_id)
        if componente_id:
            habilidades = habilidades.filter(componente__id=componente_id)
        if search_term:
            vector = SearchVector(
                "codigo_bncc",
                "descricao",
                "unidade_tematica__nome",
                "objeto_conhecimento__descricao",
            )
            query = SearchQuery(search_term)
            habilidades = (
                habilidades.annotate(rank=SearchRank(vector, query))
                .filter(rank__gte=0.01)
                .order_by("-rank")
            )

        serializer = HabilidadeSerializer(habilidades, many=True)
        logger.success(
            "Usuario %s listou %d habilidades",
            request.user.id,
            len(serializer.data),
        )
        return Response(serializer.data)


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class MapaMentalListView(generics.ListAPIView):
    queryset = MapaMental.objects.all().order_by("id")
    serializer_class = MapaMentalSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = super().get_queryset()
        componente = self.request.query_params.get("componente")
        nome = self.request.query_params.get("nome")
        q = self.request.query_params.get("q")
        if componente:
            qs = qs.filter(componente__iexact=componente)
        if nome:
            qs = qs.filter(nome_arquivo__icontains=nome)
        if q:
            qs = qs.filter(Q(componente__icontains=q) | Q(nome_arquivo__icontains=q))
        return qs

@method_decorator(xframe_options_exempt, name="dispatch")
class MapaMentalDownloadView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            mapa = MapaMental.objects.get(pk=pk)
        except MapaMental.DoesNotExist:
            raise Http404
        file_path = os.path.join(settings.BASE_DIR, mapa.caminho)
        if not os.path.exists(file_path):
            raise Http404
        download_param = request.query_params.get("download", "1")
        as_attachment = str(download_param).lower() not in ("0", "false", "inline")
        return FileResponse(
            open(file_path, "rb"),
            as_attachment=as_attachment,
            filename=mapa.nome_arquivo,
        )

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_componentes(request):
    perfil = getattr(request.user, "perfil", None)
    if perfil is None:
        comps = Componente.objects.none()
    else:
        comps = perfil.componentes.all().order_by("nome")
    serializer = ComponenteSerializer(comps, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_competencias_gerais(request):
    componente_id = request.query_params.get("componente")
    qs = CompetenciaGeral.objects.all()
    if componente_id:
        qs = qs.filter(componente_id=componente_id)
    serializer = CompetenciaGeralSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_competencias_especificas(request):
    componente_id = request.query_params.get("componente")
    nivel = request.query_params.get("nivel_ensino")
    qs = CompetenciaEspecifica.objects.all()
    if componente_id:
        qs = qs.filter(componente_id=componente_id)
    if nivel:
        qs = qs.filter(nivel_ensino=nivel)
    serializer = CompetenciaEspecificaSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def competencias_da_habilidade(request, habilidade_id):
    try:
        hab = Habilidade.objects.get(id=habilidade_id)
    except Habilidade.DoesNotExist:
        return Response({"detail": "Habilidade não encontrada"}, status=404)

    cg = CompetenciaGeralSerializer(hab.competencias_gerais.all(), many=True)
    ce = CompetenciaEspecificaSerializer(
        hab.competencias_especificas.all(), many=True
    )
    return Response({"gerais": cg.data, "especificas": ce.data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_metodologias(request):
    metodos = Metodologia.objects.all().order_by("tipo", "nome")
    serializer = MetodologiaSerializer(metodos, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_anos_escolares(request):
    """Retorna anos escolares no formato usado pelo front-end.

    Se o parâmetro ``componente`` for fornecido, filtra para retornar apenas
    os anos que possuem habilidades cadastradas para esse componente.
    """

    componente_param = request.query_params.get("componente")
    anos = AnoEscolar.objects.all()

    if componente_param:
        try:
            # Tentamos converter diretamente para inteiro (ID)
            componente_id = int(componente_param)
        except ValueError:
            # Se falhar, assumimos que veio o nome do componente (ex: "Arte")
            componente = Componente.objects.filter(nome=componente_param).first()
            componente_id = componente.id if componente else None

        if componente_id:
            anos = anos.filter(habilidade__componente_id=componente_id).distinct()
        else:
            # Nenhum componente encontrado — retorna lista vazia
            anos = AnoEscolar.objects.none()

    anos = anos.order_by("nivel_ensino", "numero_ano")
    serializer = AnoEscolarSerializer(anos, many=True)
    return Response(serializer.data)
