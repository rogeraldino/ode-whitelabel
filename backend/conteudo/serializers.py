# serializers.py
from rest_framework import serializers
from .models import (
    Habilidade,
    Componente,
    AnoEscolar,
    UnidadeTematica,
    ObjetoConhecimento,
    CompetenciaGeral,
    CompetenciaEspecifica,
    Metodologia,
    MapaMental,
)

# serializers.py
class HabilidadeSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField()                     # ➊  NOVO
    componente = serializers.CharField(source='componente.nome')
    ano = serializers.CharField(source='ano.__str__')
    unidades_tematicas = serializers.CharField(
        source='unidade_tematica.nome', allow_null=True
    )
    objetos_de_conhecimento = serializers.CharField(
        source='objeto_conhecimento.descricao', allow_null=True
    )
    habilidade_bncc = serializers.CharField(source='descricao')

    class Meta:
        model  = Habilidade
        fields = (
            'id',                                         # ➊  inclua primeiro
            'componente',
            'ano',
            'unidades_tematicas',
            'objetos_de_conhecimento',
            'codigo_bncc',
            'habilidade_bncc',
        )


class MapaMentalSerializer(serializers.ModelSerializer):
    class Meta:
        model = MapaMental
        fields = ['id', 'componente', 'nome_arquivo', 'caminho']


class ComponenteSerializer(serializers.ModelSerializer):
    permitido = serializers.SerializerMethodField()

    class Meta:
        model = Componente
        fields = ("id", "nome", "slug", "permitido")

    def get_permitido(self, obj):
        request = self.context.get("request")
        perfil = getattr(getattr(request, "user", None), "perfil", None) if request else None
        if perfil is None:
            return False
        return perfil.componentes.filter(id=obj.id).exists()


class CompetenciaGeralSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetenciaGeral
        fields = ("id", "nome", "numero", "descricao")


class CompetenciaEspecificaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetenciaEspecifica
        fields = ("id", "numero", "descricao", "nivel_ensino")


class MetodologiaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Metodologia
        fields = ("id", "nome", "definicao", "tipo")


class AnoEscolarSerializer(serializers.ModelSerializer):
    """Serializer para retornar anos escolares no formato esperado pelo front."""

    label = serializers.SerializerMethodField()
    value = serializers.SerializerMethodField()

    class Meta:
        model = AnoEscolar
        fields = ("id", "label", "value")

    def get_label(self, obj):
        if obj.nivel_ensino == obj.FUNDAMENTAL:
            return f"{obj.numero_ano}º ano Ensino Fundamental"
        return f"{obj.numero_ano}º série Ensino Médio"

    def get_value(self, obj):
        sigla = "EF" if obj.nivel_ensino == obj.FUNDAMENTAL else "EM"
        return f"{obj.numero_ano} {sigla}"
