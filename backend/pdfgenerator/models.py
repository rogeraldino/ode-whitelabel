# pdfgenerator/models.py

from django.db import models
import uuid
from django.db.models import JSONField  # Importar JSONField

# Importe os modelos dos seus outros apps.
# Certifique-se de que os nomes dos apps estejam corretos.
from atividades.models import ListaAtividade, Questao


class ModeloAtividade(models.Model):
    """
    Representa um modelo de atividades gerado a partir de uma ListaAtividade.
    Cada modelo define uma ordem específica de questões e pode ser aplicado a vários alunos.
    """
    lista_atividade = models.ForeignKey(
        ListaAtividade,
        on_delete=models.CASCADE,
        related_name='modelos_atividades',
        help_text="Lista de atividade base para este modelo de atividades."
    )
    identificador_qr = models.UUIDField(
        unique=True,
        default=uuid.uuid4,
        editable=False,
        help_text="UUID único representando este modelo de atividades (usado em QR Code impresso)."
    )
    nome_modelo = models.CharField(
        max_length=128,
        help_text="Nome descritivo para identificar este modelo de atividades (ex: Modelo A, B, etc.)."
    )
    ordem_questoes_randomizada = JSONField(
        null=True,
        blank=True,
        help_text="Ordem específica dos IDs das questões neste modelo de atividades."
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Modelo de atividades"
        verbose_name_plural = "Modelos de atividades"
        ordering = ['-criado_em']

    def __str__(self):
        return f"{self.nome_modelo} - {self.lista_atividade.nome}"


class ResultadoQuestaoModelo(models.Model):
    """
    Resultado por questão para um modelo de atividades.
    Isso reflete qual seria a correção de uma folha com esse modelo,
    sem precisar atrelar a um aluno ou nota final.
    """
    modelo_atividades = models.ForeignKey(
        ModeloAtividade,
        on_delete=models.CASCADE,
        related_name='resultados_questoes',
        help_text="Modelo de prova ao qual este resultado pertence."
    )
    questao = models.ForeignKey(
        Questao,
        on_delete=models.CASCADE,
        help_text="Questão específica relacionada a este resultado."
    )
    alternativa_correta = models.CharField(
        max_length=1,
        null=True,
        blank=True,
        help_text="Alternativa correta dessa questão (se aplicável)."
    )
    peso_definido = models.FloatField(
        null=True,
        blank=True,
        help_text="Peso definido para esta questão nesse modelo de atividades."
    )

    class Meta:
        unique_together = ('modelo_atividades', 'questao')
        verbose_name = "Resultado da Questão no Modelo"
        verbose_name_plural = "Resultados das Questões no Modelo"
        ordering = ['questao__id']

    def __str__(self):
        return f"Q{self.questao.id} ({self.alternativa_correta or '---'}) no {self.modelo_atividades.nome_modelo}"
