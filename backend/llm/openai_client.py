from openai import OpenAI
import os
import logging

logger = logging.getLogger(__name__)

# Obtém a chave da API do ambiente
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.error("OPENAI_API_KEY não encontrada no ambiente.")
    _cliente = None
else:
    # Cria o cliente apenas se a chave existir
    _cliente = OpenAI(api_key=api_key, timeout=90.0, max_retries=2)

def get_client() -> OpenAI | None:
    """Retorna o cliente OpenAI inicializado ou None se não houver chave."""
    return _cliente
