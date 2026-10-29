# backend/llm/utils.py
import json
import re
import os
import logging
from openai import OpenAI
from llm.openai_client import get_client


logger = logging.getLogger(__name__)

TRAILING_COMMAS_RE = re.compile(r",\s*(?=[}\]])")   # vírgula seguida de } ou ]

def get_openai_response_from_prompt(prompt_text: str, nivel_ensino: str, *, include_bncc: bool = True):
    num_alternativas = 4 if nivel_ensino == "Fundamental" else 5
    alternativas_exemplo = '["alt A", "alt B", "alt C", "alt D"]' if num_alternativas == 4 else '["alt A", "alt B", "alt C", "alt D", "alt E"]'

    if include_bncc:
        exemplo_objetiva = "{ ... 'a': ..., 'c': '...', 'bncc': 'EM13...', 'habilidade_id': 123 }"
        exemplo_discursiva = "{ ... 'r': '...', 'bncc': 'EM13...', 'habilidade_id': 123 }"
        regras_extra = (
            "Garanta que `habilidade_id` corresponda exatamente ao id recebido no prompt. "
            "Em objetivas, `c` deve estar em `a`. "
            f"Use exatamente {num_alternativas} alternativas."
        )
    else:
        exemplo_objetiva = "{ ... 'a': ..., 'c': '...' }"
        exemplo_discursiva = "{ ... 'r': '...' }"
        regras_extra = (
            "NÃO inclua campos de BNCC. NÃO inclua `habilidade_id`. "
            "Em objetivas, `c` deve estar em `a`. "
            f"Use exatamente {num_alternativas} alternativas."
        )

    messages = [
        {"role": "system", "content": "Você é um professor altamente qualificado..."},
        {"role": "user", "content": f"• Objetiva:\n{exemplo_objetiva}\n\n• Discursiva:\n{exemplo_discursiva}\n\n"
                                    'Sempre devolva um único objeto JSON {"1": {...}, "2": {...}, ...}. '
                                    + regras_extra},
        {"role": "user", "content": prompt_text},
    ]

    try:
        client = get_client()
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            response_format={"type": "json_object"},
        )
        resposta = completion.choices[0].message.content.strip()
        tokens_gastos = completion.usage.total_tokens
        if not resposta:
            logger.error("A resposta da OpenAI está vazia.")
            return None, tokens_gastos
        logger.info("Resposta da OpenAI obtida com sucesso. Tokens gastos: %d", tokens_gastos)
        logger.debug("Resposta da OpenAI: %s", resposta)

        return resposta, tokens_gastos

    except SystemExit as e:
        logger.error("Timeout ou falha de rede na OpenAI (SystemExit): %s", e)
        return None, 0
    except Exception as e:
        logger.exception("Erro na chamada da OpenAI: %s", e)
        return None, 0


def parse_llm_json(text: str) -> dict:
    """
    Extrai o primeiro objeto JSON de `text`.
    Remove cercas ``` e corrige aspas tipográficas se necessário.
    Lança ValueError se não encontrar JSON.
    """
    if not text:
        raise ValueError("Resposta vazia")

    # remove ```json ... ``` ou ``` ... ```
    fenced = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.S)
    if fenced:
        text = fenced.group(1)

    # troca aspas curvas por retas
    text = text.replace("“", '"').replace("”", '"')

    # isola bloco {...}
    first, last = text.find("{"), text.rfind("}")
    if first == -1 or last == -1:
        raise ValueError("Nenhum objeto JSON encontrado")
    block = text[first:last + 1]

    return json.loads(block)

def safe_json_loads(text: str) -> dict:
    """
    Tenta decodificar JSON. Se falhar, remove vírgulas finais e tenta de novo.
    Lança JSONDecodeError se continuar inválido.
    """
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        cleaned = TRAILING_COMMAS_RE.sub("", text)
        return json.loads(cleaned)



def build_generate_more_questions_prompt(contexto: dict) -> str:
    """Monta o prompt para solicitar mais questões ao modelo."""
    nivel_ensino = contexto.get("nivel_ensino", "Fundamental")
    num_alternativas = 4 if nivel_ensino == "Fundamental" else 5
    if num_alternativas == 4:
        alternativas_exemplo = '["alt A", "alt B", "alt C", "alt D"]'
    else:
        alternativas_exemplo = '["alt A", "alt B", "alt C", "alt D", "alt E"]'

    # --------- Habilidades / contexto ---------
    habilidades = contexto.get("habilidades", [])
    linhas = []
    for idx, hab in enumerate(habilidades, start=1):
        codigo = hab.get("codigo_bncc", "")
        habilidade_id = hab.get("id") or hab.get("habilidade_id")
        tema = hab.get("tema", "")
        descricao = hab.get("descricao", "")
        linhas.append(
            f"{idx}. código_bncc: {codigo}; habilidade_id: {habilidade_id}; "
            f"Tema: {tema}; Habilidade: {descricao}"
        )
    lista_habilidades_texto = "\n".join(linhas) if linhas else "(Nenhuma habilidade fornecida)"

    dificuldade_map = {
        "fácil": "fáceis",
        "médio": "médias",
        "difícil": "difíceis",
    }
    dificuldade_desc = dificuldade_map.get(contexto.get("dificuldade"), "")

    tipos = contexto.get("tipos_questoes", "objetiva")
    if tipos == "objetiva":
        tipos_formatados = "objetivas"
    elif tipos == "discursiva":
        tipos_formatados = "discursivas"
    else:
        tipos_formatados = "divididas IGUALMENTE entre objetivas e discursivas"

    contexto_json = json.dumps(contexto, ensure_ascii=False)
    return (
        f"Gere uma lista com 3 questões {dificuldade_desc} {tipos_formatados} sobre o(s) seguinte(s) assunto(s):\n\n"
        f"{lista_habilidades_texto}\n\n"
        "Responda com JSON no formato das questões objetivas ou discursivas conforme exemplos: \n"
        "Objetiva: {\n"
        '  \"q\": \"pergunta\",\n'
        '  \"solucao\": \"resolução PASSO A PASSO detalhada\",\n'
        f'  \"a\": {alternativas_exemplo},\n'
        '  \"c\": \"alt C\",\n'
        '  \"bncc\": \"EM13MAT203\",\n'
        '  \"habilidade_id\": 123\n'
        "}\n"
        "Discursiva: {\n"
        '  \"q\": \"pergunta\",\n'
        '  \"solucao\": \"resolução PASSO A PASSO detalhada\",\n'
        '  \"r\": \"resposta esperada\",\n'
        '  \"bncc\": \"EM13MAT203\",\n'
        '  \"habilidade_id\": 123\n'
        "}\n"
        f"Contexto adicional: {contexto_json}"
    )


def build_simplify_prompt(questao: dict) -> str:
    """Prompt para simplificar uma questão mantendo a correção."""
    nivel_ensino = questao.get("nivel_ensino", "Fundamental")
    num_alternativas = 4 if nivel_ensino == "Fundamental" else 5
    if num_alternativas == 4:
        alternativas_exemplo = '["alt A", "alt B", "alt C", "alt D"]'
    else:
        alternativas_exemplo = '["alt A", "alt B", "alt C", "alt D", "alt E"]'

    questao_json = json.dumps(questao, ensure_ascii=False)
    return (
        "Simplifique a questão abaixo sem alterar sua resposta correta. Retorne UMA QUESTÃO simplificada no mesmo formato JSON.\n"
        "Objetiva: {\n"
        '  "q": "pergunta",\n'
        '  "solucao": "resolução PASSO A PASSO detalhada",\n'
        f'  "a": {alternativas_exemplo},\n'
        '  "c": "alt C",\n'
        '  "bncc": "EM13MAT203",\n'
        '  "habilidade_id": 123\n'
        "}\n"
        "Discursiva: {\n"
        '  "q": "pergunta",\n'
        '  "solucao": "resolução PASSO A PASSO detalhada",\n'
        '  "r": "resposta esperada",\n'
        '  "bncc": "EM13MAT203",\n'
        '  "habilidade_id": 123\n'
        "}\n"
        f"Questão: {questao_json}"
    )


def build_harder_prompt(questao: dict) -> str:
    """Prompt para tornar a questão mais difícil."""
    nivel_ensino = questao.get("nivel_ensino", "Fundamental")
    num_alternativas = 4 if nivel_ensino == "Fundamental" else 5
    if num_alternativas == 4:
        alternativas_exemplo = '["alt A", "alt B", "alt C", "alt D"]'
    else:
        alternativas_exemplo = '["alt A", "alt B", "alt C", "alt D", "alt E"]'

    questao_json = json.dumps(questao, ensure_ascii=False)
    return (
        "Aumente a dificuldade da questão abaixo, podendo adicionar etapas extras. Retorne UMA QUESTÃO mais complexa no mesmo formato JSON.\n"
        "Objetiva: {\n"
        '  "q": "pergunta",\n'
        '  "solucao": "resolução PASSO A PASSO detalhada",\n'
        f'  "a": {alternativas_exemplo},\n'
        '  "c": "alt C",\n'
        '  "bncc": "EM13MAT203",\n'
        '  "habilidade_id": 123\n'
        "}\n"
        "Discursiva: {\n"
        '  "q": "pergunta",\n'
        '  "solucao": "resolução PASSO A PASSO detalhada",\n'
        '  "r": "resposta esperada",\n'
        '  "bncc": "EM13MAT203",\n'
        '  "habilidade_id": 123\n'
        "}\n"
        f"Questão: {questao_json}"
    )


def build_contextualize_prompt(questao: dict) -> str:
    """Prompt para contextualizar a questão em um cenário real."""
    nivel_ensino = questao.get("nivel_ensino", "Fundamental")
    num_alternativas = 4 if nivel_ensino == "Fundamental" else 5
    if num_alternativas == 4:
        alternativas_exemplo = '["alt A", "alt B", "alt C", "alt D"]'
    else:
        alternativas_exemplo = '["alt A", "alt B", "alt C", "alt D", "alt E"]'

    questao_json = json.dumps(questao, ensure_ascii=False)
    return (
        "Adicione um contexto prático à questão abaixo sem alterar a resposta correta. Retorne UMA QUESTÃO contextualizada no mesmo formato JSON.\n"
        "Objetiva: {\n"
        '  "q": "pergunta",\n'
        '  "solucao": "resolução PASSO A PASSO detalhada",\n'
        f'  "a": {alternativas_exemplo},\n'
        '  "c": "alt C",\n'
        '  "bncc": "EM13MAT203",\n'
        '  "habilidade_id": 123\n'
        "}\n"
        "Discursiva: {\n"
        '  "q": "pergunta",\n'
        '  "solucao": "resolução PASSO A PASSO detalhada",\n'
        '  "r": "resposta esperada",\n'
        '  "bncc": "EM13MAT203",\n'
        '  "habilidade_id": 123\n'
        "}\n"
        f"Questão: {questao_json}"
    )

def unwrap_single_question(data):
    if isinstance(data, dict):
        # se vier {"1": {...}} ou {"0": {...}}
        only_values = list(data.values())
        if len(only_values) == 1 and isinstance(only_values[0], dict):
            return only_values[0]
    return data