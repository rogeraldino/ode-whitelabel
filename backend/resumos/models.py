from django.db import models
import uuid

from usuario.models import Usuario
from conteudo.models import Habilidade


class Resumo(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    nome_documento = models.CharField(max_length=255)
    habilidades = models.ManyToManyField(Habilidade, related_name="resumos")
    json_openai = models.JSONField()
    assunto = models.CharField(max_length=255, null=True, blank=True)
    arquivado = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-criado_em"]

    def __str__(self):
        return self.nome_documento
