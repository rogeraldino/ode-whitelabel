# backend/llm/tasks.py
import logging
from celery import shared_task

from llm.utils import (
    parse_llm_json,
    safe_json_loads,
    unwrap_single_question,
    build_generate_more_questions_prompt,
    build_simplify_prompt,
    build_harder_prompt,
    build_contextualize_prompt,
)
from llm.utils import get_openai_response_from_prompt

from atividades.models import ListaAtividade
from atividades.utils import criar_questoes_e_alternativas

logger = logging.getLogger(__name__)

@shared_task(bind=True, queue='llm_atividades')
def tarefa_gerar_mais_questoes(self, lista_uuid):
    try:
        logger.info("[CELERY] tarefa_gerar_mais_questoes iniciada para lista_uuid=%s", lista_uuid)
        lista = (
            ListaAtividade.objects
            .select_related("componente", "ano")
            .prefetch_related("habilidades")
            .get(uuid=lista_uuid)
        )

        habilidades_qs = list(lista.habilidades.all())
        # Regra robusta: é tema livre se tiver campo tema_livre OU não tiver habilidades
        is_tema_livre = bool((lista.tema_livre or "").strip()) or (len(habilidades_qs) == 0)

        # -------------------------------------------------------------
        # Tema livre → sem BNCC/habilidade_id
        # -------------------------------------------------------------
        if is_tema_livre:
            nivel_ensino = lista.ano.nivel_ensino if lista.ano else "Fundamental"

            dificuldade_map = {"fácil": "fáceis", "médio": "médias", "difícil": "difíceis"}
            dificuldade_desc = dificuldade_map.get(lista.dificuldade, "médias")

            if lista.tipos_questoes == "objetiva":
                tipos_formatados = "objetivas"
            elif lista.tipos_questoes == "discursiva":
                tipos_formatados = "discursivas"
            else:
                tipos_formatados = "divididas IGUALMENTE entre objetivas e discursivas"

            tema = (lista.tema_livre or "").strip() or "assunto livre"
            componente_txt = lista.componente.nome if lista.componente else "—"
            ano_txt = f"{lista.ano.numero_ano}º – {lista.ano.nivel_ensino}" if lista.ano else "—"

            prompt = (
                f"Gere uma lista com 3 questões {dificuldade_desc} {tipos_formatados} "
                f"sobre o tema: '{tema}'.\n\n"
                f"Componente (se aplicável): {componente_txt}\n"
                f"Ano/Série (se aplicável): {ano_txt}\n\n"
                "Responda com JSON no formato das questões objetivas ou discursivas conforme exemplos:\n"
                "Objetiva: {\n"
                '  \"q\": \"pergunta\",\n'
                '  \"solucao\": \"resolução PASSO A PASSO detalhada\",\n'
                '  \"a\": [\"alt A\", \"alt B\", \"alt C\", \"alt D\"],\n'
                '  \"c\": \"alt C\"\n'
                "}\n"
                "Discursiva: {\n"
                '  \"q\": \"pergunta\",\n'
                '  \"solucao\": \"resolução PASSO A PASSO detalhada\",\n'
                '  \"r\": \"resposta esperada\"\n'
                "}\n"
                'Sempre devolva UM ÚNICO objeto JSON no formato {"1": {...}, "2": {...}, "3": {...}}.'
            )

            resposta, _ = get_openai_response_from_prompt(
                prompt, nivel_ensino, include_bncc=False
            )

        # -------------------------------------------------------------
        # Com BNCC → manter comportamento, mas sem quebrar em níveis mistos
        # -------------------------------------------------------------
        else:
            habilidades = [
                {
                    "id": h.id,
                    "codigo_bncc": h.codigo_bncc,
                    "descricao": h.descricao,
                    "tema": h.unidade_tematica.nome if h.unidade_tematica else "(sem tema)",
                }
                for h in habilidades_qs
            ]

            niveis_ensino = [h.ano.nivel_ensino for h in habilidades_qs if h.ano]
            niveis_set = set(niveis_ensino)

            # Fallback: se misto, prioriza o nível do Ano da lista; se não houver, escolhe o mais frequente; se empatar, "Fundamental"
            if len(niveis_set) == 1:
                nivel_ensino = niveis_set.pop()
            else:
                if lista.ano and lista.ano.nivel_ensino:
                    nivel_ensino = lista.ano.nivel_ensino
                    logger.warning(
                        "[CELERY] níveis mistos nas habilidades; usando nível do Ano da lista: %s",
                        nivel_ensino,
                    )
                elif niveis_ensino:
                    # mais frequente
                    from collections import Counter
                    nivel_ensino = Counter(niveis_ensino).most_common(1)[0][0]
                    logger.warning(
                        "[CELERY] níveis mistos nas habilidades; usando nível mais frequente: %s",
                        nivel_ensino,
                    )
                else:
                    nivel_ensino = "Fundamental"
                    logger.warning(
                        "[CELERY] não foi possível determinar nível; usando fallback: %s",
                        nivel_ensino,
                    )

            contexto = {
                "nivel_ensino": nivel_ensino,
                "dificuldade": lista.dificuldade,
                "tipos_questoes": lista.tipos_questoes,
                "habilidades": habilidades,
            }

            prompt = build_generate_more_questions_prompt(contexto)
            resposta, _ = get_openai_response_from_prompt(
                prompt, nivel_ensino, include_bncc=True
            )

        # -------------------------------------------------------------
        # Parsing e persistência
        # -------------------------------------------------------------
        if not resposta:
            logger.error("[CELERY] resposta vazia da OpenAI em tarefa_gerar_mais_questoes")
            return {"erro": "Falha ao gerar questões"}

        try:
            data = parse_llm_json(resposta)
        except Exception:
            data = safe_json_loads(resposta)

        if isinstance(data, list):
            resposta_dict = {str(i + 1): q for i, q in enumerate(data)}
        else:
            resposta_dict = data

        criar_questoes_e_alternativas(resposta_dict, lista)

        lista.quantidade_questoes = lista.questoes.count()
        lista.save(update_fields=["quantidade_questoes"])

        logger.info(
            "[CELERY] tarefa_gerar_mais_questoes concluída com %d questões (tema_livre=%s)",
            len(resposta_dict), is_tema_livre
        )
        return {"sucesso": True, "quantidade": len(resposta_dict)}

    except Exception as e:
        logger.exception("[CELERY] erro em tarefa_gerar_mais_questoes: %s", e)
        return {"erro": str(e)}


@shared_task(bind=True, queue='llm_atividades')
def tarefa_aprimorar_questao(self, questao, tipo: str):
    try:
        logger.info("[CELERY] tarefa_aprimorar_questao iniciada - tipo=%s", tipo)

        if tipo == "simplificar":
            prompt = build_simplify_prompt(questao)
        elif tipo == "dificultar":
            prompt = build_harder_prompt(questao)
        elif tipo == "contextualizar":
            prompt = build_contextualize_prompt(questao)
        else:
            return {"erro": "Tipo inválido"}

        resposta, _ = get_openai_response_from_prompt(
            prompt, questao.get("nivel_ensino", "Fundamental")
        )

        if not resposta:
            logger.error("[CELERY] resposta vazia da OpenAI em tarefa_aprimorar_questao")
            return {"erro": "Falha na chamada à OpenAI"}

        try:
            data = parse_llm_json(resposta)
        except Exception:
            data = safe_json_loads(resposta)

        data = unwrap_single_question(data)

        logger.info("[CELERY] tarefa_aprimorar_questao concluída com sucesso")
        return {"sucesso": True, "dados": data}

    except Exception as e:
        logger.exception("[CELERY] erro em tarefa_aprimorar_questao: %s", e)
        return {"erro": str(e)}
