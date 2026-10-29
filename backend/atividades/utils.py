"""
backend/atividades/utils.py
Refatorado para trabalhar com habilidades identificadas por id
e lidar com possíveis repetidos no codigo_bncc.
"""
import json
import logging
from typing import List, Tuple, Optional

from django.db import transaction
from atividades.models import ListaAtividade, Questao, Alternativa
from conteudo.models import Componente, AnoEscolar, Habilidade
from usuario.models import Usuario
from prompts.utils import gerar_prompt_a_partir_dos_dados
from llm.utils import get_openai_response_from_prompt

logger = logging.getLogger(__name__)

SIGLA_PARA_NIVEL = {
    "EF": "Fundamental",
    "EM": "Médio",
}


def _coletar_questoes_existentes(
    habilidades: List[Habilidade], limite: int = 4
) -> List[dict]:
    """Retorna até ``limite`` enunciados de questões já cadastradas."""

    if not habilidades:
        return []

    habilidade_ids = [h.id for h in habilidades if getattr(h, "id", None)]
    if not habilidade_ids:
        return []

    questoes_qs = (
        Questao.objects.filter(habilidade_id__in=habilidade_ids)
        .order_by("-id")
        .values_list("enunciado", flat=True)
    )

    existentes: List[dict] = []
    enunciados_vistos = set()
    for enunciado in questoes_qs.iterator():
        enunciado_limpo = (enunciado or "").strip()
        if not enunciado_limpo or enunciado_limpo in enunciados_vistos:
            continue

        existentes.append({"enunciado": enunciado_limpo})
        enunciados_vistos.add(enunciado_limpo)

        if len(existentes) >= limite:
            break

    return existentes

# ---------------------------------------------------------------------------
# 0. Util – parse de Ano/Série
# ---------------------------------------------------------------------------
def _parse_ano_escolar(ano_escolar_str: str) -> Optional[AnoEscolar]:
    """
    Aceita '6 EF', '2 EM' ou vazio (tema livre sem ano).
    """
    if not ano_escolar_str:
        return None
    try:
        numero_ano_str, nivel_sigla = ano_escolar_str.strip().split()
        numero_ano = int(numero_ano_str)
        nivel_ensino = SIGLA_PARA_NIVEL.get(nivel_sigla.upper())
        if not nivel_ensino:
            raise ValueError(f"Nível de ensino inválido: {nivel_sigla}")
        return AnoEscolar.objects.get(numero_ano=numero_ano, nivel_ensino=nivel_ensino)
    except Exception as e:
        logger.warning("AnoEscolar opcional não resolvido (%s): %s", ano_escolar_str, e)
        return None


# ---------------------------------------------------------------------------
# 1. Geração do prompt
# ---------------------------------------------------------------------------
def processar_prompt(data, habilidades_queryset):
    try:
        habilidades_lista = (
            list(habilidades_queryset) if habilidades_queryset is not None else []
        )
        existing_questions = _coletar_questoes_existentes(habilidades_lista)

        prompt_gerado = gerar_prompt_a_partir_dos_dados(
            data,
            habilidades_lista,
            existing_questions=existing_questions,
        )
        logger.info("Prompt gerado: %s", prompt_gerado)
        return prompt_gerado
    except Exception as e:
        logger.error("Erro ao gerar prompt: %s", e)
        raise


# ---------------------------------------------------------------------------
# 2. Chamada à LLM
# ---------------------------------------------------------------------------
def obter_resposta_openai(
        prompt_gerado: str, nivel_ensino: Optional[str], include_bncc: bool
):
    """
    Quando include_bncc=False, instruímos o modelo a NÃO emitir 'bncc'/'habilidade_id'.
    """
    try:
        resposta, tokens = get_openai_response_from_prompt(
            prompt_gerado,
            nivel_ensino or "Fundamental",  # fallback seguro
            include_bncc=include_bncc,
            )
        logger.info("Resposta do OpenAI (crua) obtida!")
        return resposta, tokens
    except Exception as e:
        logger.error("Erro ao obter resposta do OpenAI: %s", e)
        raise


# ---------------------------------------------------------------------------
# 3. Limpeza da resposta
# ---------------------------------------------------------------------------
def limpar_resposta_openai(resposta: str) -> str:
    try:
        if resposta.startswith("```json"):
            resposta = resposta[len("```json") :].strip()
            if resposta.endswith("```"):
                resposta = resposta[: -len("```")].strip()
        elif resposta.startswith("```"):
            resposta = resposta[len("```") :].strip()
            if resposta.endswith("```"):
                resposta = resposta[: -len("```")].strip()
        return resposta.strip()
    except Exception as e:
        logger.error("Erro ao limpar a resposta da OpenAI: %s", e)
        raise


# ---------------------------------------------------------------------------
# 4. Resolução das FKs e queryset de habilidades
# ---------------------------------------------------------------------------
def recuperar_dados_relacionados(data):
    """
    Retorna (usuario, componente|None, ano_escolar|None, habilidades_queryset)
    Agora BNCC é opcional. Para tema livre:
      - `tema_livre` em data (string)
      - `componente`/`anoEscolar` opcionais
    """
    try:
        # Usuário: aceita userEmail (preferencial) ou userId
        user_email = data.get("userEmail")
        user_id = data.get("userId")
        if user_email:
            usuario = Usuario.objects.get(email=user_email)
        elif user_id:
            usuario = Usuario.objects.get(id=user_id)
        else:
            raise ValueError("userEmail ou userId obrigatório.")

        # Componente opcional (tema livre)
        componente = None
        if data.get("componente"):
            componente = Componente.objects.get(nome=data.get("componente"))

        # Ano opcional (tema livre)
        ano_escolar = _parse_ano_escolar(data.get("anoEscolar", ""))

        # Habilidades: id list (preferencial) ou legado por código
        habilidade_ids = data.get("habilidade_ids", []) or []
        if habilidade_ids:
            habilidades = Habilidade.objects.filter(id__in=habilidade_ids)
        elif "habilidade" in data:
            logger.warning(
                "Campo legado 'habilidade' (códigos BNCC) recebido. Prefira 'habilidade_ids'."
            )
            qs = Habilidade.objects.filter(codigo_bncc__in=data["habilidade"])
            if componente:
                qs = qs.filter(componente=componente)
            if ano_escolar:
                qs = qs.filter(ano=ano_escolar)
            habilidades = qs
        else:
            habilidades = Habilidade.objects.none()

        logger.info("Usuario %s: dados relacionados recuperados", usuario.id)
        return usuario, componente, ano_escolar, habilidades

    except Usuario.DoesNotExist:
        logger.error(
            "Usuário não encontrado para %r/%r.", data.get("userEmail"), data.get("userId")
        )
        raise
    except Componente.DoesNotExist:
        logger.error("Componente não encontrado: %r", data.get("componente"))
        raise
    except AnoEscolar.DoesNotExist:
        logger.error("AnoEscolar não encontrado: %r", data.get("anoEscolar"))
        raise
    except Habilidade.DoesNotExist:
        logger.error(
            "Habilidades não encontradas: ids=%r ou códigos=%r",
            data.get("habilidade_ids"),
            data.get("habilidade"),
        )
        raise
    except Exception as e:
        logger.error("Erro ao recuperar dados relacionados: %s", e)
        raise


# ---------------------------------------------------------------------------
# 5. Criação da ListaAtividade
# ---------------------------------------------------------------------------
def criar_lista_atividade(data: dict) -> dict:
    try:
        logger.info("Requisição recebida com dados: %s", data)

        usuario, componente, ano_escolar, habilidades = recuperar_dados_relacionados(data)

        # Tema livre se NÃO tiver habilidades
        is_tema_livre = not habilidades.exists()
        tema_livre_str = (data.get("tema_livre") or "").strip() if is_tema_livre else ""

        # Gera prompt com ou sem BNCC
        prompt_gerado = processar_prompt(data, habilidades)
        resposta, tokens = obter_resposta_openai(
            prompt_gerado,
            ano_escolar.nivel_ensino if ano_escolar else None,
            include_bncc=not is_tema_livre,
        )
        resposta_limpa = limpar_resposta_openai(resposta)
        logger.info("Resposta limpa da OpenAI: %s", resposta_limpa)
        logger.info("Tokens gastos: %s", tokens)

        # Tenta decodificar JSON
        try:
            resposta_openai_dict = json.loads(resposta_limpa)
        except json.JSONDecodeError as e:
            logger.exception("Erro ao decodificar JSON: %s", e)

            quantidade_necessaria = int(data.get("numQuestoes", 0))

            # Fallback:
            #   - BNCC: pega do banco por habilidades
            #   - Tema livre: tenta por componente/ano
            if not is_tema_livre:
                qs_fallback = list(
                    Questao.objects.filter(habilidade__in=habilidades)[:quantidade_necessaria]
                )
            else:
                q = Questao.objects.all()
                if componente:
                    q = q.filter(habilidade__componente=componente)
                if ano_escolar:
                    q = q.filter(habilidade__ano=ano_escolar)
                qs_fallback = list(q[:quantidade_necessaria])

            if not qs_fallback:
                raise Exception(
                    "Desculpe, a geração falhou. Tente novamente em alguns minutos."
                )

            lista_atividade = criar_lista_model(
                data,
                usuario,
                habilidades,
                prompt_gerado,
                tokens,
                tema_livre=tema_livre_str,
                componente=componente,
                ano_escolar=ano_escolar,
            )
            lista_atividade.questoes.add(*qs_fallback)
            lista_atividade.quantidade_questoes = lista_atividade.questoes.count()
            lista_atividade.save(update_fields=["quantidade_questoes"])

            mensagem = "Lista criada usando questões existentes do banco de dados."
            if len(qs_fallback) < quantidade_necessaria:
                mensagem += " Não havia questões suficientes para a quantidade solicitada."

            return {"mensagem": mensagem, "lista_uuid": str(lista_atividade.uuid)}

        # Cria lista, questões e alternativas (JSON OK)
        lista_atividade = criar_lista_model(
            data,
            usuario,
            habilidades,
            prompt_gerado,
            tokens,
            tema_livre=tema_livre_str,
            componente=componente,
            ano_escolar=ano_escolar,
        )
        logger.info("ListaAtividade criada com ID %d", lista_atividade.id)

        criar_questoes_e_alternativas(resposta_openai_dict, lista_atividade)
        logger.info("Questões e alternativas criadas com sucesso.")
        logger.success(
            "Usuario %s: Lista de atividades %s criada pelo usuário",
            usuario.id,
            str(lista_atividade.uuid),
        )

        return {
            "mensagem": "Lista de atividades criada com sucesso!",
            "lista_uuid": str(lista_atividade.uuid),
        }

    except Exception as e:
        logger.exception("Erro inesperado na criação da lista: %s", e)
        raise


def criar_lista_model(
        data,
        usuario,
        habilidades,
        prompt_gerado,
        tokens,
        *,
        tema_livre="",
        componente=None,
        ano_escolar=None,
):
    try:
        dificuldade_map = {"1": "fácil", "2": "médio", "3": "difícil"}
        dificuldade_str = dificuldade_map.get(str(data.get("dificuldade")), "médio")
        tipos_str = _normalizar_tipos(data.get("tiposSelecionados"))

        lista_atividade = ListaAtividade.objects.create(
            usuario=usuario,
            nome=data.get("nomeLista"),
            quantidade_questoes=data.get("numQuestoes"),
            dificuldade=dificuldade_str,
            tipos_questoes=tipos_str,
            prompt=prompt_gerado,
            status="criada",
            tokens_gastos=tokens,
            tema_livre=tema_livre or None,
            componente=componente,
            ano=ano_escolar,
        )
        if habilidades.exists():
            lista_atividade.habilidades.set(habilidades)

        logger.success(
            "Usuario %s: ListaAtividade %s criada com sucesso.", usuario.id, lista_atividade.id
        )
        return lista_atividade

    except Exception as e:
        logger.error("Erro ao criar ListaAtividade: %s", e)
        raise


def _normalizar_tipos(tiposSelecionados):
    """
    Entrada esperada do front: lista ['objetiva'] | ['discursiva'] | ['objetiva','discursiva'].
    O model espera: 'objetiva' | 'discursiva' | 'ambas'.
    """
    if not tiposSelecionados:
        return "objetiva"
    tipos = set(tiposSelecionados)
    if tipos == {"objetiva"}:
        return "objetiva"
    if tipos == {"discursiva"}:
        return "discursiva"
    return "ambas"


# ---------------------------------------------------------------------------
# 6. Criação das Questões e Alternativas (versão robusta)
# ---------------------------------------------------------------------------
def criar_questoes_e_alternativas(resposta_openai_dict, lista_atividade):
    """
    Espera dicionário {chave: {...}} já limpo.
    Campos aceitos por item:
      q, a (lista), c, r, solucao, habilidade_id, bncc
    """

    if not isinstance(resposta_openai_dict, dict):
        logger.error(
            "Resposta do LLM não é dict (é %s). Abortando.",
            type(resposta_openai_dict).__name__,
        )
        return

    questoes_para_criar: List[Questao] = []
    # guardará, na mesma ordem de `questoes_para_criar`, os dados para alternativas
    dados_para_alternativas: List[Tuple[List[str], int]] = []
    letras = ["A", "B", "C", "D", "E"]

    habilidades_lista_por_codigo = {
        h.codigo_bncc: h for h in lista_atividade.habilidades.all()
    }

    # Ordena por chave numérica quando possível, para estabilidade
    def _key_ord(k):
        try:
            return int(k)
        except (TypeError, ValueError):
            return 1_000_000

    itens = sorted(resposta_openai_dict.items(), key=lambda kv: _key_ord(kv[0]))

    for chave, questao_data in itens:
        if not isinstance(questao_data, dict):
            logger.error(
                "Questão %r inválida: tipo %s. Conteúdo: %r",
                chave,
                type(questao_data).__name__,
                questao_data,
            )
            continue

        enunciado = (questao_data.get("q") or "").strip()
        if not enunciado:
            logger.error("Questão %r sem enunciado 'q'. Dados: %r", chave, questao_data)
            continue

        # Tipo: objetiva se houver 'a' válido e >= 2; senão discursiva.
        alternativas = _flatten_alternativas(questao_data.get("a"))
        tipo = "objetiva" if len(alternativas) >= 2 else "discursiva"

        resposta_discursiva = (
            (questao_data.get("r") or "").strip() if tipo == "discursiva" else None
        )
        solucao = (questao_data.get("solucao") or "").strip() or None

        habilidade = _resolver_habilidade(questao_data, habilidades_lista_por_codigo)

        questoes_para_criar.append(
            Questao(
                tipo=tipo,
                enunciado=enunciado,
                resposta_discursiva=resposta_discursiva,
                habilidade=habilidade,
                solucao=solucao,
                dificuldade=lista_atividade.dificuldade,
                fonte="IA Generativa Especializada",
            )
        )

        if tipo == "objetiva":
            idx_correto = _indice_correto(questao_data.get("c"), alternativas)
            if idx_correto == -1:
                logger.warning(
                    "Questão %r sem resposta correta coerente; marcarei nenhuma como correta.",
                    chave,
                )
            dados_para_alternativas.append((alternativas, idx_correto))
        else:
            dados_para_alternativas.append(([], -1))

    if not questoes_para_criar:
        logger.error("Nenhuma questão válida para criar. Encerrando.")
        return

    with transaction.atomic():
        # Cria questões e associa à lista
        Questao.objects.bulk_create(questoes_para_criar)
        lista_atividade.questoes.add(*questoes_para_criar)

        alternativas_para_criar: List[Alternativa] = []
        for questao, (alternativas, idx_correto) in zip(
                questoes_para_criar, dados_para_alternativas
        ):
            if questao.tipo != "objetiva":
                continue

            # Garante no máximo 5 alternativas
            alternativas = alternativas[: min(len(alternativas), len(letras))]
            for i, texto in enumerate(alternativas):
                correta = i == idx_correto
                alternativas_para_criar.append(
                    Alternativa(
                        questao=questao,
                        texto=texto,
                        letra=letras[i],
                        correta=correta,
                    )
                )

        if alternativas_para_criar:
            Alternativa.objects.bulk_create(alternativas_para_criar)

    logger.success(
        "%d questões criadas (objetivas: %d, discursivas: %d) para a lista %s",
        len(questoes_para_criar),
        sum(1 for q in questoes_para_criar if q.tipo == "objetiva"),
        sum(1 for q in questoes_para_criar if q.tipo == "discursiva"),
        lista_atividade.id,
    )


def _flatten_alternativas(a) -> List[str]:
    """Garante lista plana de strings, no máximo 5 itens, sem None/empty."""
    if not isinstance(a, list):
        return []
    flat = []
    for item in a:
        if isinstance(item, list):
            flat.extend(
                [str(x).strip() for x in item if x is not None and str(x).strip()]
            )
        else:
            if item is not None and str(item).strip():
                flat.append(str(item).strip())
    # remove duplicatas mantendo ordem
    seen = set()
    uniq = []
    for x in flat:
        if x not in seen:
            seen.add(x)
            uniq.append(x)
    return uniq[:5]


def _resolver_habilidade(questao_data, habilidades_lista_por_codigo):
    codigo_bncc = questao_data.get("bncc")
    habilidade_id = questao_data.get("habilidade_id")
    habilidade = None

    if habilidade_id:
        habilidade = Habilidade.objects.filter(id=habilidade_id).first()
        if habilidade is None:
            logger.warning("Habilidade id %s não encontrada.", habilidade_id)

    if habilidade is None and codigo_bncc in habilidades_lista_por_codigo:
        habilidade = habilidades_lista_por_codigo[codigo_bncc]

    if habilidade is None and codigo_bncc:
        qs = Habilidade.objects.filter(codigo_bncc=codigo_bncc)
        if qs.exists():
            habilidade = qs.first()
            if qs.count() > 1:
                logger.warning(
                    "Há %s habilidades com BNCC %s (ids: %s). Usando a primeira (%s).",
                    qs.count(),
                    codigo_bncc,
                    list(qs.values_list("id", flat=True)),
                    habilidade.id,
                )
        else:
            logger.warning(
                "BNCC %s não encontrada; questão ficará sem habilidade.", codigo_bncc
            )
    return habilidade


def _indice_correto(c_val, alternativas: List[str]) -> int:
    """
    Converte `c` em índice 0-based.
    Aceita:
      - texto exatamente igual a uma alternativa;
      - inteiro (1-based ou 0-based);
      - letra 'A'..'E'.
    Retorna -1 se não for possível determinar.
    """
    if not alternativas:
        return -1

    # 1) Texto igual
    if isinstance(c_val, str) and c_val.strip():
        # letra?
        letra = c_val.strip().upper()
        if len(letra) == 1 and "A" <= letra <= "E":
            idx = ord(letra) - ord("A")
            return idx if 0 <= idx < len(alternativas) else -1
        # texto igual a alguma alternativa
        try:
            return alternativas.index(c_val.strip())
        except ValueError:
            pass

    # 2) Índice numérico (pode vir como str)
    try:
        num = int(c_val)
        # tenta 1-based primeiro
        if 1 <= num <= len(alternativas):
            return num - 1
        # tenta 0-based
        if 0 <= num < len(alternativas):
            return num
    except (TypeError, ValueError):
        pass

    return -1
