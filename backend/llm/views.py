# llm/views.py
from openai import OpenAI
from dotenv import load_dotenv

import json, os, logging, re
from celery.result import AsyncResult
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from llm.utils import (
    parse_llm_json,
    safe_json_loads,
    build_generate_more_questions_prompt,
    build_simplify_prompt,
    build_harder_prompt,
    build_contextualize_prompt,
    unwrap_single_question,
)
from llm.tasks import (
    tarefa_gerar_mais_questoes,
    tarefa_aprimorar_questao
)
from llm.openai_client import get_client
from atividades.models import ListaAtividade
from atividades.serializers import QuestaoSerializer

load_dotenv()  # Carrega variáveis do .env

logger = logging.getLogger(__name__)

def gerar_recursos_e_avaliacao(
        componente,
        ano,
        habilidade,
        competencias_gerais,
        competencias_especificas,
        metodologia,
        observacao="",
):
    """
    Gera (JSON, tokens) onde JSON contém apenas:
      {
        "recursos_didaticos": "...",
        "avaliacao": "..."
      }
    A lógica de prompt foi mantida, mas a função agora faz sua própria
    chamada à OpenAI, independente de `get_openai_response_from_prompt`.
    """

    # ---------- 1. Montagem do prompt ---------------------------------
    unidade = habilidade.unidade_tematica.nome if habilidade.unidade_tematica else ""
    objeto = habilidade.objeto_conhecimento.descricao if habilidade.objeto_conhecimento else ""
    cgs_txt = ", ".join(f"CG{c.numero} - {c.descricao}" for c in competencias_gerais)
    ces_txt = ", ".join(f"CE{c.numero} - {c.descricao}" for c in competencias_especificas)
    metodo_desc = f"{metodologia.tipo} - {metodologia.definicao}" if metodologia else ""

    prompt_usuario = (
        "A partir dos dados abaixo, gere apenas os campos 'recursos_didaticos' "
        "e 'avaliacao' JSON. Os dois campos devem estar alinhados ao componente, "
        "ano escolar, habilidade, unidade temática, competências e metodologia.\n\n"
        f"Componente: {componente.nome}\n"
        f"Ano: {ano}\n"
        f"Código BNCC: {habilidade.codigo_bncc}\n"
        f"Descrição da habilidade: {habilidade.descricao}\n"
        f"Unidade temática: {unidade}\n"
        f"Objeto do conhecimento: {objeto}\n"
        f"Competências gerais: {cgs_txt}\n"
        f"Competências específicas: {ces_txt}\n"
        f"Metodologia: {metodo_desc}\n"
        f"Observação: {observacao}\n\n"
        "Exemplo de resposta JSON (o conteudo de cada chave deve vir SEMPRE em formato de lista):\n"
        '{"recursos_didaticos": "...", "avaliacao": "..."}'
    )

    # ---------- 2. Prepara mensagens ----------------------------------
    messages = [
        {
            "role": "system",
            "content": (
                "Você é um pedagogo especialista em BNCC. "
                "Responda sempre em JSON válido contendo SOMENTE "
                "os campos requisitados: 'recursos_didaticos' e 'avaliacao'."
            ),
        },
        {"role": "user", "content": prompt_usuario},
    ]

    # ---------- 3. Chamada à OpenAI -----------------------------------
    client = get_client()

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            response_format={"type": "json_object"},  # força JSON
        )
        resposta = completion.choices[0].message.content.strip()
        tokens_gastos = completion.usage.total_tokens

        if not resposta:
            logger.error("A resposta da OpenAI veio vazia.")
            return None, tokens_gastos

        logger.info(
            "Recursos & avaliação gerados com sucesso. Tokens gastos: %d",
            tokens_gastos,
        )
        logger.debug("Resposta: %s", resposta)
        return resposta, tokens_gastos

    except Exception as e:
        logger.exception("Falha na chamada OpenAI: %s", e)
        return None, 0


def _safe_json_loads(raw: str):
    """
    Remove vírgulas de cauda em { …, } ou [ …, ] e decodifica o JSON.
    Lança JSONDecodeError caso continue inválido.
    """
    raw = re.sub(r',(\s*[}\]])', r'\1', raw)  # vírgula antes de } ou ]
    return json.loads(raw)


@api_view(["POST"])
def gerar_mais_questoes(request):
    lista_uuid = request.data.get("lista_uuid")
    logger.info("Criando mais 3 questões para a lista: " + request.data.get("lista_uuid"))
    if not lista_uuid:
        return Response(
            {"erro": "lista_uuid é obrigatório"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    task = tarefa_gerar_mais_questoes.delay(lista_uuid)
    return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)



@api_view(["POST"])
def simplificar_questao(request):
    questao = request.data or {}
    task = tarefa_aprimorar_questao.delay(questao, "simplificar")
    return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)



@api_view(["POST"])
def dificultar_questao(request):
    questao = request.data or {}
    task = tarefa_aprimorar_questao.delay(questao, "dificultar")
    return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)



@api_view(["POST"])
def contextualizar_questao(request):
    questao = request.data or {}
    task = tarefa_aprimorar_questao.delay(questao, "contextualizar")
    return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
def resultado_task(request, task_id):
    result = AsyncResult(task_id)

    if result.failed():
        return Response({"erro": "Erro ao processar a tarefa"}, status=500)
    elif result.ready():
        return Response(result.result, status=200)
    else:
        return Response({"status": "PENDENTE"}, status=202)



def gerar_plano_estruturado(
        componente,
        ano,
        habilidade,
        competencias_gerais,
        competencias_especificas,
        metodologia,
        observacao="",
):
    """
    Gera um plano de aula estruturado com minutagem específica (5min, 15min, 15min, 10min, 5min)
    baseado na metodologia escolhida.
    
    Retorna (dict_json, tokens_gastos)
    """
    
    # ---------- 1. Montagem do prompt ---------------------------------
    unidade = habilidade.unidade_tematica.nome if habilidade.unidade_tematica else ""
    objeto = habilidade.objeto_conhecimento.descricao if habilidade.objeto_conhecimento else ""
    cgs_txt = ", ".join(f"CG{c.numero} - {c.descricao}" for c in competencias_gerais)
    ces_txt = ", ".join(f"CE{c.numero} - {c.descricao}" for c in competencias_especificas)
    if metodologia:
        metodo_info = f"{metodologia.tipo} - {metodologia.nome}\n"
        metodo_info += f"Definição: {metodologia.definicao}\n"
        if metodologia.descricao:
            metodo_info += f"Descrição: {metodologia.descricao}"
        metodo_desc = metodo_info.strip()
    else:
        metodo_desc = ""

    prompt_usuario = (
        "Gere um plano de aula estruturado seguindo EXATAMENTE o formato JSON abaixo. "
        "O plano deve ter duração total de 50 minutos, dividido em: "
        "5 minutos (Introdução), 15 minutos (Desenvolvimento 1), 15 minutos (Desenvolvimento 2), "
        "10 minutos (Aplicação), 5 minutos (Conclusão).\n\n"
        f"Componente: {componente.nome}\n"
        f"Ano: {ano}\n"
        f"Código BNCC: {habilidade.codigo_bncc}\n"
        f"Descrição da habilidade: {habilidade.descricao}\n"
        f"Unidade temática: {unidade}\n"
        f"Objeto do conhecimento: {objeto}\n"
        f"Competências gerais: {cgs_txt}\n"
        f"Competências específicas: {ces_txt}\n"
        f"Metodologia: {metodo_desc}\n"
        f"Observação: {observacao}\n\n"
        "Use a metodologia escolhida para estruturar as atividades de cada seção. "
        "Seja específico e prático nas instruções.\n\n"
        "FORMATO JSON OBRIGATÓRIO:\n"
        '{\n'
        '  "titulo": "Plano de Aula: [Tema] ([Ano])",\n'
        '  "duracao": "50 minutos",\n'
        '  "metodologia": "Aprendizagem Ativa",\n'
        '  "objetivo_geral": "Capacitar os alunos a [objetivo principal] com confiança e precisão, aplicando o conhecimento em diferentes contextos.",\n'
        '  "objetivos_especificos": [\n'
        '    "Revisar os conceitos básicos de [tema]",\n'
        '    "Compreender e aplicar as regras para [conceito 1]",\n'
        '    "Realizar [conceito 2] de [tema]",\n'
        '    "Resolver problemas que envolvam [tema]"\n'
        '  ],\n'
        '  "recursos": [\n'
        '    "Lousa ou projetor",\n'
        '    "Marcadores ou canetas",\n'
        '    "Materiais impressos com exercícios e problemas",\n'
        '    "Recursos digitais (vídeos explicativos, jogos interativos - opcional)"\n'
        '  ],\n'
        '  "desenvolvimento": {\n'
        '    "introducao": {\n'
        '      "tempo": "5 minutos",\n'
        '      "titulo": "Introdução e Revisão",\n'
        '      "atividades": [\n'
        '        "Comece a aula relembrando o conceito de [tema]: o que representam [conceitos básicos]",\n'
        '        "Pergunte aos alunos sobre os diferentes tipos de [tema] e como [aplicação]",\n'
        '        "Faça uma breve revisão de como [processo básico]"\n'
        '      ]\n'
        '    },\n'
        '    "desenvolvimento_1": {\n'
        '      "tempo": "15 minutos",\n'
        '      "titulo": "[Tema] - Parte 1",\n'
        '      "atividades": [\n'
        '        "Explique que para [conceito 1], basta [regra básica]",\n'
        '        "Exemplo: [exemplo prático com números]",\n'
        '        "Resolva alguns exemplos na lousa e peça aos alunos para resolverem outros individualmente"\n'
        '      ]\n'
        '    },\n'
        '    "desenvolvimento_2": {\n'
        '      "tempo": "15 minutos",\n'
        '      "titulo": "[Tema] - Parte 2",\n'
        '      "atividades": [\n'
        '        "Explique que, antes de [conceito 2], é necessário [pré-requisito]",\n'
        '        "Exemplo: Para [situação], encontre [processo]",\n'
        '        "Converta as [unidades] para [formato comum] e demonstre o processo passo a passo"\n'
        '      ]\n'
        '    },\n'
        '    "aplicacao": {\n'
        '      "tempo": "10 minutos",\n'
        '      "titulo": "Resolução de Problemas",\n'
        '      "atividades": [\n'
        '        "Apresente alguns problemas práticos que envolvam [tema]",\n'
        '        "Exemplo: [problema contextualizado com números]",\n'
        '        "Incentive os alunos a trabalhar em grupos pequenos para resolver os problemas",\n'
        '        "Circule pela sala, oferecendo ajuda e orientação quando necessário",\n'
        '        "Peça a alguns grupos para apresentarem suas soluções e explique os diferentes métodos"\n'
        '      ]\n'
        '    },\n'
        '    "conclusao": {\n'
        '      "tempo": "5 minutos",\n'
        '      "titulo": "Conclusão e Exercícios",\n'
        '      "atividades": [\n'
        '        "Faça um resumo dos principais pontos abordados na aula",\n'
        '        "Destaque a importância de praticar regularmente para dominar [tema]",\n'
        '        "Atribua alguns exercícios para os alunos resolverem em casa como tarefa",\n'
        '        "Indique recursos online ou livros para estudo adicional"\n'
        '      ]\n'
        '    }\n'
        '  },\n'
        '  "avaliacao": [\n'
        '    "A participação dos alunos durante a aula pode ser usada como uma forma de avaliação contínua",\n'
        '    "A resolução dos exercícios em sala de aula e a tarefa para casa podem ser avaliadas para verificar a compreensão dos conceitos",\n'
        '    "Uma breve prova ou questionário pode ser aplicado na aula seguinte para avaliar o aprendizado dos alunos"\n'
        '  ],\n'
        '  "observacoes": [\n'
        '    "Adapte o ritmo da aula de acordo com o nível de compreensão dos alunos",\n'
        '    "Use exemplos práticos e relevantes para tornar o conteúdo mais interessante",\n'
        '    "Incentive a participação ativa dos alunos, promovendo discussões e troca de ideias"\n'
        '  ]\n'
        '}'
    )

    # ---------- 2. Prepara mensagens ----------------------------------
    messages = [
        {
            "role": "system",
            "content": (
                "Você é um pedagogo especialista em BNCC e metodologias ativas. "
                "Você está criando um plano de aula estruturado e detalhado. "
                "Responda SEMPRE em JSON válido seguindo EXATAMENTE o formato fornecido. "
                "Use a metodologia escolhida para estruturar as atividades de forma prática e engajante. "
                "Seja específico nos exemplos e atividades propostas."
            ),
        },
        {"role": "user", "content": prompt_usuario},
    ]

    # ---------- 3. Chamada à OpenAI -----------------------------------
    client = get_client()

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            response_format={"type": "json_object"},  # força JSON
        )
        resposta = completion.choices[0].message.content.strip()
        tokens_gastos = completion.usage.total_tokens

        if not resposta:
            logger.error("A resposta da OpenAI veio vazia.")
            return None, tokens_gastos

        logger.info(
            "Plano estruturado gerado com sucesso. Tokens gastos: %d",
            tokens_gastos,
        )
        logger.debug("Resposta: %s", resposta)
        return resposta, tokens_gastos

    except Exception as e:
        logger.exception("Falha na chamada OpenAI: %s", e)
        return None, 0


def gerar_resumo_disciplinar(habilidade, ano):
    """
    Gera um resumo estruturado (título · introdução · seções) e inclui
    exemplos de questões com solução passo a passo detalhada.

    Retorna (dict_json, tokens_gastos)
    """
    # ---------------------------------------------------------
    # ► Dados da habilidade usados no prompt
    # ---------------------------------------------------------
    obj_conh = habilidade.objeto_conhecimento.descricao or ""
    codigo = habilidade.codigo_bncc
    nome_resumido = habilidade.descricao.split(",")[0].strip()

    # ---------------------------------------------------------
    # ► Instruções de formato enviadas ao modelo
    # ---------------------------------------------------------
    FORMAT = f"""
Responda SOMENTE com o JSON abaixo (sem ``` e sem texto extra).

{{
  "title": "{codigo} – {nome_resumido}",
  "introduction": "<mín. 40 palavras>",
  "sections": [
    {{
      "heading": "Definição",
      "description": "<≈50 palavras>",
      "bullets": ["..."]
    }},
    {{
      "heading": "Conceitos Básicos",
      "description": "<≈40 palavras>",
      "bullets": ["..."]
    }},
    {{
      "heading": "Aplicações Práticas",
      "description": "<≈30 palavras>",
      "bullets": ["..."]
    }},
    {{
      "heading": "Exemplos de Questões",
      "description": "<≈30 palavras>",
      "bullets": [
        {{
          "question": "Enunciado 1 …",
          "solution": [
            "Passo 1 – …",
            "Passo 2 – …",
            "Passo 3 – …",
            "Passo 4 – …",
            "...",
            "Resposta final: …"
          ]
        }},
        {{
          "question": "Enunciado 2 …",
          "solution": [
            "Passo 1 – …",
            "Passo 2 – …",
            "Passo 3 – …",
            "Passo 4 – …",
            "...",
            "Resposta final: …"
          ]
        }}
      ]
    }}
  ],
  "conclusion": "<mín. 40 palavras>"
}}

Regras:
• NÃO altere nomes de seções.
• Seções (exceto “Exemplos…”) → 3–6 bullets, 20–30 palavras cada.
• Em “solution” produza 4–6 passos explicativos; último passo = “Resposta final: …”.
"""

    # ---------------------------------------------------------
    # ► Construção das mensagens
    # ---------------------------------------------------------
    messages = [
        {
            "role": "system",
            "content": (
                "Você é pedagogo especialista em BNCC. Você está redigindo um resumo para seus alunos lerem e assimilar o conteúdo escolhido. "
                "Siga rigorosamente o FORMATO fornecido."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Ano/Série: {ano}\n"
                f"Código BNCC: {codigo}\n"
                f"Descrição da habilidade: {habilidade.descricao}\n"
                f"Objeto de conhecimento: {obj_conh}\n\n"
                f"{FORMAT}"
            ),
        },
    ]

    # ---------------------------------------------------------
    # ► Chamada ao modelo
    # ---------------------------------------------------------
    client = get_client()
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},  # garante JSON válido
            messages=messages,
        )
    except Exception as exc:
        logger.exception("Falha na chamada OpenAI: %s", exc)
        return None, 0

    raw = completion.choices[0].message.content.strip()

    # --- sanitização mínima (caso ainda venha entre ```json ``` ) ---
    raw = re.sub(r"```(?:json)?\s*([\s\S]*?)\s*```", r"\1", raw).strip()

    first, last = raw.find("{"), raw.rfind("}")
    if first == -1 or last == -1:
        logger.error("Objeto JSON não encontrado: %r", raw)
        return None, 0

    try:
        resumo_dict = _safe_json_loads(raw[first:last + 1])
    except json.JSONDecodeError as exc:
        logger.exception("JSON inválido após limpeza: %s\nConteúdo bruto: %r", exc, raw)
        return None, 0

    tokens_gastos = completion.usage.total_tokens
    return resumo_dict, tokens_gastos

