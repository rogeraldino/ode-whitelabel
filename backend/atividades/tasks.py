# backend/atividades/tasks.py
from celery import shared_task
import logging

# IMPORTA A IMPLEMENTAÇÃO NOVA (tema livre + BNCC)
# atividades/tasks.py (atual)
from atividades.utils import criar_lista_atividade

logger = logging.getLogger(__name__)

@shared_task(bind=True, queue="llm_atividades", max_retries=2, default_retry_delay=15)
def task_criar_lista(self, data: dict):
    """
    Dispara a criação da lista e PERSISTE as questões (tema livre => habilidade=None).
    Retorna sempre {"sucesso": True, "dados": {"mensagem": "...", "lista_uuid": "..."}}.
    """
    user_id = data.get("userId")
    if not user_id:
        raise Exception("ID do usuário não fornecido")

    try:
        resultado = criar_lista_atividade(data)
        # resultado esperado: {"mensagem": "...", "lista_uuid": "..."}
        logger.info("Lista criada com sucesso via task: %s", resultado)
        return {"sucesso": True, "dados": resultado}
    except Exception as exc:
        logger.exception("Falha ao criar lista")
        raise self.retry(exc=exc)
