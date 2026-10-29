# backend/conteudo/models.py
from django.db import models
from django.db.models import Q
from django.core.exceptions import ValidationError


# -------------------------------------------------------------
#  Componentes curriculares (Matemática, Português, etc.)
# -------------------------------------------------------------
class Componente(models.Model):
    nome = models.TextField(unique=True)
    slug = models.SlugField(unique=True)

    class Meta:
        ordering = ["nome"]

    def __str__(self):
        return self.nome


# -------------------------------------------------------------
#  Ano Escolar – chave composta (numero_ano, nivel_ensino)
# -------------------------------------------------------------
class AnoEscolar(models.Model):
    FUNDAMENTAL = "Fundamental"
    MEDIO = "Médio"

    NIVEL_CHOICES = [
        (FUNDAMENTAL, "Ensino Fundamental"),
        (MEDIO, "Ensino Médio"),
    ]

    numero_ano = models.PositiveSmallIntegerField()
    nivel_ensino = models.CharField(max_length=12, choices=NIVEL_CHOICES)

    class Meta:
        unique_together = ("numero_ano", "nivel_ensino")
        ordering = ["nivel_ensino", "numero_ano"]
        indexes = [
            models.Index(fields=["nivel_ensino", "numero_ano"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=(
                        (Q(nivel_ensino="Fundamental") & Q(numero_ano__gte=1) & Q(numero_ano__lte=9))
                        | (Q(nivel_ensino="Médio") & Q(numero_ano__gte=1) & Q(numero_ano__lte=3))
                ),
                name="ano_escolar_intervalo_valido",
            )
        ]

    def clean(self):
        if self.nivel_ensino == self.FUNDAMENTAL and not 1 <= self.numero_ano <= 9:
            raise ValidationError("Para o Ensino Fundamental o número deve estar de 1 a 9.")
        if self.nivel_ensino == self.MEDIO and not 1 <= self.numero_ano <= 3:
            raise ValidationError("Para o Ensino Médio o número deve estar de 1 a 3.")

    def __str__(self):
        return f"{self.numero_ano}º – {self.nivel_ensino}"


# -------------------------------------------------------------
#  Competências (gerais e específicas)
# -------------------------------------------------------------
class CompetenciaGeral(models.Model):
    numero = models.PositiveSmallIntegerField()
    descricao = models.TextField()
    componente = models.ForeignKey(Componente, on_delete=models.CASCADE)
    nome = models.CharField("Nome da Competência Geral", max_length=120)
    # Geral não depende de nível de ensino, mas mantemos o campo para consulta futura
    nivel_ensino = models.CharField(
        max_length=12, choices=AnoEscolar.NIVEL_CHOICES, blank=True, null=True
    )

    class Meta:
        unique_together = ("numero", "componente")
        ordering = ["numero"]

    def __str__(self):
        return f"CG{self.numero} – {self.componente}"


class CompetenciaEspecifica(models.Model):
    numero = models.PositiveSmallIntegerField()
    descricao = models.TextField()
    componente = models.ForeignKey(Componente, on_delete=models.CASCADE)
    nivel_ensino = models.CharField(max_length=12, choices=AnoEscolar.NIVEL_CHOICES)

    class Meta:
        unique_together = ("numero", "componente", "nivel_ensino")
        ordering = ["nivel_ensino", "numero"]

    def __str__(self):
        return f"CE{self.numero} – {self.nivel_ensino} – {self.componente}"


# -------------------------------------------------------------
#  Unidade Temática
# -------------------------------------------------------------
class UnidadeTematica(models.Model):
    nome = models.TextField(unique=True)

    class Meta:
        ordering = ["nome"]

    def __str__(self):
        return self.nome


# -------------------------------------------------------------
#  Objeto de Conhecimento
# -------------------------------------------------------------
class ObjetoConhecimento(models.Model):
    descricao = models.TextField(unique=True)

    class Meta:
        ordering = ["descricao"]

    def __str__(self):
        return self.descricao


# -------------------------------------------------------------
#  Habilidade (BNCC)
# -------------------------------------------------------------
class Habilidade(models.Model):
    id = models.BigAutoField(primary_key=True)

    codigo_bncc = models.CharField(max_length=10)  # não-único de propósito
    descricao = models.TextField()

    componente = models.ForeignKey(Componente, on_delete=models.CASCADE)
    ano = models.ForeignKey(AnoEscolar, on_delete=models.CASCADE)
    unidade_tematica = models.ForeignKey(
        UnidadeTematica, on_delete=models.SET_NULL, null=True, blank=True
    )
    objeto_conhecimento = models.ForeignKey(
        ObjetoConhecimento, on_delete=models.SET_NULL, null=True, blank=True
    )

    # Novas relações
    competencias_gerais = models.ManyToManyField(
        CompetenciaGeral, blank=True, related_name="habilidades"
    )
    competencias_especificas = models.ManyToManyField(
        CompetenciaEspecifica, blank=True, related_name="habilidades"
    )

    class Meta:                                           # ← alinhada com os campos
        ordering = ["codigo_bncc"]
        unique_together = ("codigo_bncc", "objeto_conhecimento", "ano")  # ← NOVO
        indexes = [
            models.Index(fields=["codigo_bncc"]),
            models.Index(fields=["ano", "componente"]),
        ]

    def __str__(self):
        return f"{self.codigo_bncc} – {self.descricao[:60]}…"


# ------------------------------------------------------------------
#   Mapa Mental
# ------------------------------------------------------------------
class MapaMental(models.Model):
    componente = models.CharField(max_length=100)
    nome_arquivo = models.CharField(max_length=255)
    caminho = models.CharField(max_length=500)

    def __str__(self):
        return f"{self.componente} - {self.nome_arquivo}"
      
class Metodologia(models.Model):
    ATIVA = "Ativa"
    EXPOSITIVA = "Expositiva"

    TIPO_CHOICES = [
        (ATIVA, "Metodologia Ativa"),
        (EXPOSITIVA, "Metodologia Expositiva"),
    ]

    nome = models.TextField(unique=True)
    definicao = models.TextField()
    descricao = models.TextField(blank=True, null=True)
    tipo = models.CharField(max_length=12, choices=TIPO_CHOICES)

    class Meta:
        ordering = ["tipo", "nome"]

    def __str__(self):
        return f"{self.tipo} – {self.nome}"