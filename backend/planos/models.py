from django.db import models
import uuid
from conteudo.models import (
    Componente,
    AnoEscolar,
    Habilidade,
    CompetenciaGeral,
    CompetenciaEspecifica,
    Metodologia,
)
from usuario.models import Usuario


class PlanoDeAula(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    nome = models.CharField(max_length=128)
    componente = models.ForeignKey(Componente, on_delete=models.PROTECT)
    ano = models.ForeignKey(AnoEscolar, on_delete=models.PROTECT)
    habilidade = models.ForeignKey(Habilidade, on_delete=models.PROTECT)
    competencias_gerais = models.ManyToManyField(CompetenciaGeral, blank=True)
    competencias_especificas = models.ManyToManyField(CompetenciaEspecifica, blank=True)
    metodologia = models.ForeignKey(Metodologia, on_delete=models.SET_NULL, null=True, blank=True)
    avaliacao = models.JSONField(default=list, null=True, blank=True)
    recursos_didaticos = models.JSONField(default=list, null=True, blank=True)
    referencias_bibliograficas = models.TextField(null=True, blank=True)
    observacao = models.TextField(null=True, blank=True)
    plano_estruturado = models.JSONField(default=dict, null=True, blank=True)
    arquivado = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-criado_em']

    def __str__(self):
        return f"Plano {self.uuid}"
