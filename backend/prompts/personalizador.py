# backend/prompts/personalizador.py
import re
from typing import Iterable
from conteudo.models import AnoEscolar

BNCC_FIELDS_REGEX = re.compile(r"(?i)(bncc|habilidade_id)")

def ano_key(ano: AnoEscolar | None) -> str | None:
    if not ano:
        return None
    sigla = "EF" if ano.nivel_ensino == "Fundamental" else "EM"
    return f"{ano.numero_ano} {sigla}"

def montar_lista_habilidades_texto(habilidades_qs: Iterable) -> str:
    linhas = []
    for idx, h in enumerate(habilidades_qs, start=1):
        tema = h.unidade_tematica.nome if h.unidade_tematica else "(sem tema)"
        linhas.append(
            f"{idx}. código_bncc: {h.codigo_bncc}; habilidade_id: {h.id}; Tema: {tema}; Habilidade: {h.descricao}"
        )
    return "\n".join(linhas) if linhas else ""

def tipos_formatados_from_front(tipos_sel: list[str] | None) -> str:
    tipos_sel = tipos_sel or []
    s = set(tipos_sel)
    if s == {"objetiva", "discursiva"}:
        return "divididas IGUALMENTE entre objetivas e discursivas"
    if "discursiva" in s:
        return "discursivas"
    return "objetivas"

def dificuldade_desc_from_front(d: str | int | None) -> str:
    mapa = {"1": "fáceis", "2": "médias", "3": "difíceis"}
    return mapa.get(str(d), "médias")

def preencher_template_bruto(template: str, **kwargs) -> str:
    return template.format(**kwargs)

def remover_exigencias_bncc(template_text: str) -> str:
    """
    Remove linhas/trechos que obrigam BNCC/habilidade_id e substitui
    a referência à lista de habilidades por um marcador de tema livre.
    """
    # remove menções explícitas a "incluindo ... habilidade_id"
    texto = re.sub(r"(?i),?\s*incluindo o? campo[s]? habilidade_id [^.,]*[.,]?", " ", template_text)
    texto = re.sub(r"(?i)incluindo o? campo[s]? habilidade_id [^.,]*$", " ", texto)
    # remove instruções “alinhadas à BNCC”/“ecoar habilidade_id”, caso existam
    texto = re.sub(r"(?i)alinhad[oa]s? à BNCC[^.]*\.", " ", texto)
    texto = re.sub(r"(?i)\bBNCC\b[^.]*\.", " ", texto)

    # troca referências à lista de habilidades por tema livre (cobre variações do catálogo)
    texto = texto.replace(
        "sobre os seguintes assuntos: {lista_habilidades_texto}",
        "sobre o tema: '{tema_livre}'"
    )
    texto = texto.replace(
        "considerando os seguintes conteúdos: {lista_habilidades_texto}",
        "sobre o tema: '{tema_livre}'"
    )
    # saneia espaços duplicados
    texto = re.sub(r"\s{2,}", " ", texto)
    return texto.strip()

def proibir_elementos_graficos(texto: str) -> str:
    regra = (
        "\nImportante: produza apenas texto corrido; é proibido solicitar ou incluir "
        "tabelas, gráficos, imagens, diagramas ou infográficos."
    )
    return texto + regra
