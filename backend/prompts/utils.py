# backend/prompts/utils.py
"""
Geração de prompts para atividades, com personalização por ano/série.

Fluxos:
1) Com BNCC (há habilidades): exige 'habilidade_id' (e permite 'bncc').
2) Tema livre (sem habilidades): PROÍBE 'bncc' e 'habilidade_id'.

Novidade:
- Integra templates personalizados por ano (catalogo_por_ano.YEAR_TEMPLATES).
- Quando há template para o ano informado, o texto-base é extraído do catálogo
  e tem seus placeholders preenchidos; em seguida, anexamos as regras de FORMATO
  já usadas no pipeline. Se não houver template, mantém o comportamento original.

Regras de formato (compatíveis com o parser):
- Objetiva: q (str), a (array 2..5 strings), c (índice 1..N OU letra OU texto), solucao (str opcional)
- Discursiva: q (str), r (str), solucao (str opcional)
Sempre responder em um ÚNICO objeto JSON: {"1": {...}, "2": {...}, ...}
"""

import json
import re
from typing import Iterable, Optional

# Utilidades novas para personalização
from prompts.personalizador import (
    ano_key,
    montar_lista_habilidades_texto,
    tipos_formatados_from_front,
    dificuldade_desc_from_front,
    preencher_template_bruto,
    remover_exigencias_bncc,
    proibir_elementos_graficos,
)
from prompts.catalogo_por_ano import YEAR_TEMPLATES


def _format_existing_questions(existing_questions: Optional[Iterable[dict]]) -> str:
    if not existing_questions:
        return ""

    linhas = [
        "existing_questions (ENUNCIADOS já cadastrados; NÃO repita elementos deles):",
    ]

    for item in existing_questions:
        try:
            linhas.append(f"- {json.dumps(item, ensure_ascii=False)}")
        except TypeError:
            linhas.append(f"- {item}")

    linhas.extend(
        [
            "",
            "Regras de anti-repetição (obrigatórias):",
            "- Não reutilize enunciado, estrutura, sequência de passos, valores numéricos, nomes próprios, cenários ou alternativas presentes em existing_questions.",
            "- Se qualquer nova questão ficar muito parecida com alguma de existing_questions (mesma ideia + mesmos números/mesmo texto/base estrutural), regenere a questão mudando pelo menos 2 eixos entre:",
            "  • Contexto (ex.: mercado → esporte → transporte → natureza → tecnologia escolar);",
            "  • Representação (texto → tabela → gráfico ASCII → figura/diagramas simples → lista/padrões);",
            "  • Forma (situação-problema, comparação, verdadeiro/falso com justificativa, ordenação, correspondência, completação de lacunas);",
            "  • Números/objetos (trocar grandezas, faixas, operações, frações ↔ decimais ↔ porcentagens);",
            "  • Verbo cognitivo (identificar, calcular, estimar, justificar, comparar, generalizar).",
            "- Evite sobreposição lexical: não copie 8 ou mais palavras consecutivas de qualquer questão existente.",
            "- Variedade mínima no conjunto: entre as N questões, garanta ao menos 3 formatos diferentes e 3 contextos diferentes.",
            "- Garanta funcionalidade e qualidade na stack trace.",
            "",
        ]
    )

    return "\n".join(linhas)


def _join_prompt_sections(*parts: str) -> str:
    blocos = [parte for parte in parts if parte]
    return "\n\n".join(blocos)


def _parse_ano_escolar_local(ano_escolar_str: str):
    """
    Proxy para o parser já existente em atividades.utils._parse_ano_escolar.
    Mantido aqui para evitar import circular explícito no topo.
    """
    if not ano_escolar_str:
        return None
    try:
        from atividades.utils import _parse_ano_escolar as _parse
        return _parse(ano_escolar_str)
    except Exception:
        return None


# --------------------------- Blocos fixos de FORMATO ---------------------------

FORMATO_BNCC = (
    "FORMATO OBRIGATÓRIO (JSON ÚNICO):\n"
    "{\n"
    '  "1": {\n'
    '    "q": "<enunciado>",\n'
    '    "solucao": "<resolução PASSO A PASSO detalhada>",\n'
    '    "a": ["<alt1>", "<alt2>", "<alt3>", "<alt4>"... até 5],\n'
    '    "c": "<texto da correta OU letra (A..E) OU índice (1..N)>",\n'
    '    "bncc": "<código BNCC>",\n'
    '    "habilidade_id": <id inteiro>\n'
    "  },\n"
    '  "2": { ... }\n'
    "}\n"
    "- Em objetivas, `c` DEVE estar presente em `a` (se usar letra, ela aponta para a posição em `a`).\n"
    "- Em discursivas, use `r` no lugar de `a`/`c`:\n"
    '{ "q": "...", "solucao": "...", "r": "<resposta esperada>", "bncc": "...", "habilidade_id": 123 }\n'
    "- NUNCA use chaves separadas 'a','b','c','d','e' para alternativas. SEMPRE um array `a`.\n"
)

FORMATO_TEMA_LIVRE = (
    "FORMATO OBRIGATÓRIO (JSON ÚNICO, SEM BNCC):\n"
    "{\n"
    '  "1": {\n'
    '    "q": "<enunciado>",\n'
    '    "solucao": "<resolução PASSO A PASSO detalhada>",\n'
    '    "a": ["<alt1>", "<alt2>", "<alt3>", "<alt4>"... até 5],\n'
    '    "c": "<texto da correta OU letra (A..E) OU índice (1..N)>"\n'
    "  },\n"
    '  "2": { ... }\n'
    "}\n"
    "- Em discursivas, use `r` no lugar de `a`/`c`:\n"
    '{ "q": "...", "solucao": "...", "r": "<resposta esperada>" }\n'
    "- PROIBIDO incluir `bncc` ou `habilidade_id`.\n"
    "- NUNCA use chaves separadas 'a','b','c','d','e' para alternativas. SEMPRE um array `a`.\n"
)


# --------------------------- Função principal (API) ---------------------------

def gerar_prompt_a_partir_dos_dados(
    data,
    habilidades_queryset,
    *,
    existing_questions: Optional[Iterable[dict]] = None,
) -> str:
    """
    Constrói o texto que será enviado à LLM.

    • Se houver habilidades (BNCC): exigir `habilidade_id` (e permitir `bncc`)
    • Se for tema livre (sem habilidades): PROIBIR `bncc` e `habilidade_id`
    • Formato de saída padronizado e compatível com o parser:
        - Objetiva: q (str), a (array 2..5 strings), c (índice 1..N OU letra OU texto), solucao (str opcional)
        - Discursiva: q (str), r (str), solucao (str opcional)
      Sempre em um ÚNICO objeto JSON: {"1": {...}, "2": {...}, ...}
    • existing_questions (iterável opcional) injeta exemplos já cadastrados para guiar regras anti-repetição.
    """

    # -------- Variáveis de entrada / normalizações --------
    num_questoes = data.get("numQuestoes") or 5
    dificuldade_desc = dificuldade_desc_from_front(data.get("dificuldade"))

    tipos_recebidos = data.get("tiposSelecionados") or []
    if isinstance(tipos_recebidos, str):
        tipos_recebidos = [tipos_recebidos]

    tipos_normalizados = {
        str(tipo).strip().lower() for tipo in tipos_recebidos if str(tipo).strip()
    }
    if not tipos_normalizados:
        tipos_normalizados = {"objetiva"}

    tipos_fmt = tipos_formatados_from_front(list(tipos_normalizados))
    tem_discursiva = "discursiva" in tipos_normalizados
    apenas_discursivas = tem_discursiva and len(tipos_normalizados) == 1
    enfase_discursiva = ""
    if tem_discursiva:
        if apenas_discursivas:
            enfase_discursiva = (
                "ATENÇÃO: TODAS as questões DEVEM ser DISCURSIVAS. "
                "Produza enunciados que exijam respostas textuais completas, sem alternativas, "
                "e preencha somente o campo `r` para a resposta esperada."
            )
        else:
            enfase_discursiva = (
                "ATENÇÃO: A lista precisa trazer questões DISCURSIVAS junto das objetivas. "
                "Inclua obrigatoriamente itens discursivos equilibrados com os objetivos "
                "e utilize o campo `r` para registrar a resposta esperada nas discursivas."
            )

    componente = data.get("componente") or ""
    ano_escolar_str = data.get("anoEscolar") or ""  # exemplo: "6 EF", "2 EM"

    # Habilidades (BNCC) — queryset pode ser None
    habilidades = list(habilidades_queryset) if habilidades_queryset is not None else []
    tem_bncc = bool(habilidades)
    existing_section = _format_existing_questions(existing_questions)

    # Tenta resolver o AnoEscolar para aplicar template por ano
    # 1) Tenta chave direto da string (não depende do BD)
    key = None
    m = re.match(r"^\s*(\d+)\s*(EF|EM)\s*$", str(ano_escolar_str or ""), flags=re.I)
    if m:
        key = f"{int(m.group(1))} {m.group(2).upper()}"

    # 2) Se não deu pela string, tenta via BD (opcional)
    if not key:
        ano_obj = _parse_ano_escolar_local(ano_escolar_str)
        key = ano_key(ano_obj) if ano_obj else None

    # 3) Busca o template
    template_regulado = YEAR_TEMPLATES.get(key, {}).get("prompt") if key else None
    try:
        import logging
        _log = logging.getLogger(__name__)
        _log.info("[PROMPT] anoEscolar_str=%r -> key=%r | template=%s",
                  ano_escolar_str, key, "OK" if template_regulado else "NONE")
    except Exception:
        pass

    import logging; logging.getLogger(__name__).info("Template por ano | key=%r | aplicado=%s", key, bool(template_regulado))

    # =========================== FLUXO COM BNCC ===========================
    if tem_bncc:
        if template_regulado:
            # Usa o template específico do ano e injeta as variáveis
            lista_habilidades_texto = montar_lista_habilidades_texto(habilidades)
            prompt_base = preencher_template_bruto(
                template_regulado,
                num_questoes=num_questoes,
                dificuldade_desc=dificuldade_desc,
                tipos_formatados=tipos_fmt,
                ano_escolar=ano_escolar_str,
                lista_habilidades_texto=lista_habilidades_texto,
                componente=componente or "o componente selecionado",
            )
            prompt_base = proibir_elementos_graficos(prompt_base)

            return _join_prompt_sections(
                prompt_base,
                enfase_discursiva,
                existing_section,
                FORMATO_BNCC
                + "Responda SOMENTE com o objeto JSON especificado (sem texto extra).",
            )

        # ----- Fallback: comportamento original se não houver template -----
        linhas = []
        for idx, h in enumerate(habilidades, start=1):
            tema = h.unidade_tematica.nome if h.unidade_tematica else "(sem tema)"
            linhas.append(
                f"{idx}. código_bncc: {h.codigo_bncc}; habilidade_id: {h.id}; Tema: {tema}; Habilidade: {h.descricao}"
            )
        habilidades_txt = "\n".join(linhas)

        prompt_base = (
            f"Gere {num_questoes} questões {dificuldade_desc} {tipos_fmt} alinhadas à BNCC.\n\n"
            f"Componente: {componente}\n"
            f"Ano/Série: {ano_escolar_str}\n"
            f"Habilidades (use-as como foco e ecoe o `habilidade_id` EXATO):\n{habilidades_txt}\n\n"
        )
        prompt_base = proibir_elementos_graficos(prompt_base)

        return _join_prompt_sections(
            prompt_base,
            enfase_discursiva,
            existing_section,
            FORMATO_BNCC
            + "Responda SOMENTE com o objeto JSON especificado (sem texto extra).",
        )

    # ========================= FLUXO TEMA LIVRE ===========================
    tema_livre = (data.get("tema_livre") or "").strip()
    contexto_extra = (data.get("contexto") or "").strip()

    if template_regulado:
        # Reaproveita o template do ano, removendo exigências de BNCC/habilidade_id e
        # trocando "assuntos" por tema livre.
        template_sem_bncc = remover_exigencias_bncc(template_regulado)
        prompt_base = preencher_template_bruto(
            template_sem_bncc,
            num_questoes=num_questoes,
            dificuldade_desc=dificuldade_desc,
            tipos_formatados=tipos_fmt,
            ano_escolar=ano_escolar_str or "(não informado)",
            lista_habilidades_texto="",  # ignorado no template limpo
            tema_livre=tema_livre or "assunto livre",
            componente=componente or "o componente selecionado",
        )
        prompt_base = proibir_elementos_graficos(prompt_base)

        # Observações/Contexto opcionais (mantém compatibilidade)
        obs = ""
        if componente:
            obs += f"Componente (se aplicável): {componente}\n"
        if ano_escolar_str:
            obs += f"Ano/Série (se aplicável): {ano_escolar_str}\n"
        if contexto_extra:
            obs += f"Observações/Contexto: {contexto_extra}\n"

        obs_section = obs.strip()
        return _join_prompt_sections(
            prompt_base,
            enfase_discursiva,
            obs_section,
            FORMATO_TEMA_LIVRE
            + "Responda SOMENTE com o objeto JSON especificado (sem texto extra).",
        )

    # ----- Fallback: comportamento original de tema livre -----
    prompt_base = (
            f"Gere {num_questoes} questões {dificuldade_desc} {tipos_fmt} sobre o tema: '{tema_livre}'.\n"
            + (f"Componente (se aplicável): {componente}\n" if componente else "")
            + (f"Ano/Série (se aplicável): {ano_escolar_str}\n" if ano_escolar_str else "")
            + (f"Observações/Contexto: {contexto_extra}\n" if contexto_extra else "")
            + "\n"
    )
    prompt_base = proibir_elementos_graficos(prompt_base)

    return _join_prompt_sections(
        prompt_base,
        enfase_discursiva,
        FORMATO_TEMA_LIVRE
        + "Responda SOMENTE com o objeto JSON especificado (sem texto extra).",
    )
