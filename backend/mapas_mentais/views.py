import os
import unicodedata
from urllib.parse import unquote
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.clickjacking import xframe_options_exempt


def _slugify(value: str) -> str:
    """Simplified slugify removing accents and spaces."""
    nfkd = unicodedata.normalize("NFKD", value)
    without_accents = "".join(c for c in nfkd if not unicodedata.combining(c))
    return without_accents.lower().replace(" ", "_")


def _component_name_from_slug(slug: str) -> str:
    """Return component name with original capitalization from conteudo/data."""
    base_dir = Path(settings.BASE_DIR) / "conteudo" / "data"
    if base_dir.exists():
        for disciplina_dir in base_dir.iterdir():
            if disciplina_dir.is_dir() and _slugify(disciplina_dir.name) == slug:
                return disciplina_dir.name
    return slug


@require_GET
def listar_componentes_curriculares(request):
    """Lista componentes curriculares que possuem mapas mentais.

    Em vez de buscar em ``mapas_mentais/Data`` (pasta que pode não existir
    no ambiente de desenvolvimento), percorremos ``conteudo/data`` e
    verificamos quais disciplinas possuem um diretório ``mapas_mentais``.
    Assim, disciplinas como Biologia passam a ser listadas corretamente.
    """

    base_dir = Path(settings.BASE_DIR) / "conteudo" / "data"
    componentes: list[str] = []

    if base_dir.exists():
        for disciplina_dir in base_dir.iterdir():
            if not disciplina_dir.is_dir():
                continue
            if (disciplina_dir / "mapas_mentais").is_dir():
                componentes.append(disciplina_dir.name)

    componentes.sort()
    return JsonResponse({"componentes": componentes})


@require_GET
def listar_subcomponentes(request):
    """Lista subpastas (áreas/temas) para um componente específico."""
    componente = request.GET.get("componente")
    base_dir = Path(settings.BASE_DIR) / "mapas_mentais" / "Data"
    subcomponentes: list[str] = []

    if base_dir.exists() and componente:
        slug = _slugify(componente)
        for comp_dir in base_dir.iterdir():
            if not comp_dir.is_dir() or _slugify(comp_dir.name) != slug:
                continue
            for area_dir in comp_dir.iterdir():
                if area_dir.is_dir():
                    subcomponentes.append(area_dir.name)

    subcomponentes.sort()
    return JsonResponse({"subcomponentes": subcomponentes})


@require_GET
def listar_mapas(request):
    """Lista mapas mentais disponíveis com filtros e paginação simples."""
    base_dir = Path(settings.BASE_DIR) / "mapas_mentais" / "Data"
    componente_param = request.GET.get("componente")
    sub_param = request.GET.get("subcomponente")
    busca = request.GET.get("q")

    try:
        page = int(request.GET.get("page", 1))
        page_size = int(request.GET.get("page_size", 50))
    except ValueError:
        page, page_size = 1, 50

    mapas: list[dict] = []
    if base_dir.exists():
        for comp_dir in base_dir.iterdir():
            if not comp_dir.is_dir():
                continue
            if componente_param and _slugify(comp_dir.name) != _slugify(componente_param):
                continue
            componente_nome = _component_name_from_slug(comp_dir.name)
            for area_dir in comp_dir.iterdir():
                if not area_dir.is_dir():
                    continue
                if sub_param and area_dir.name != sub_param:
                    continue
                for pdf in area_dir.glob("*.pdf"):
                    nome_arq = pdf.name
                    if busca and busca.lower() not in nome_arq.lower():
                        continue
                    rel_path = pdf.relative_to(base_dir).as_posix()
                    mapas.append(
                        {
                            "id": rel_path,
                            "componente": componente_nome,
                            "subcomponente": area_dir.name,
                            "nome_arquivo": nome_arq,
                            "caminho": rel_path,
                        }
                    )

    total = len(mapas)
    start = (page - 1) * page_size
    end = start + page_size
    return JsonResponse({"count": total, "results": mapas[start:end]})


@require_GET
@xframe_options_exempt
def baixar_mapa_mental(request, caminho):
    """Serve um arquivo PDF de mapa mental.

    A querystring ``download`` controla se o arquivo deve ser exibido inline
    (``download=0``) ou se deve forçar o download (qualquer outro valor).
    """
    data_dir = os.path.join(settings.BASE_DIR, 'mapas_mentais', 'Data')

    # Normaliza e valida o caminho solicitado
    relative_path = os.path.normpath(unquote(caminho))
    absolute_path = os.path.abspath(os.path.join(data_dir, relative_path))
    if not absolute_path.startswith(os.path.abspath(data_dir)) or not os.path.isfile(absolute_path):
        raise Http404

    download_param = request.GET.get('download', '1')
    as_attachment = str(download_param).lower() not in ('0', 'false', 'inline')

    return FileResponse(
        open(absolute_path, 'rb'),
        as_attachment=as_attachment,
        filename=os.path.basename(absolute_path),
        content_type='application/pdf',
    )
