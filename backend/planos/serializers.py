from rest_framework import serializers
from .models import PlanoDeAula

class PlanoDeAulaSerializer(serializers.ModelSerializer):
    usuario = serializers.HiddenField(default=serializers.CurrentUserDefault())
    competencias_gerais = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=PlanoDeAula._meta.get_field('competencias_gerais').related_model.objects.all(),
    )
    competencias_especificas = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=PlanoDeAula._meta.get_field('competencias_especificas').related_model.objects.all(),
    )

    # ↓↓↓  Campos que agora são listas ↓↓↓
    recursos_didaticos = serializers.ListField(
        child=serializers.CharField(), required=False, allow_empty=True
    )
    avaliacao = serializers.ListField(
        child=serializers.CharField(), required=False, allow_empty=True
    )
    plano_estruturado = serializers.JSONField(required=False, allow_null=True)
    codigos_bncc = serializers.SerializerMethodField()
    ano_escolar = serializers.CharField(source="ano.__str__", read_only=True)
    componente_nome = serializers.CharField(source="componente.nome", read_only=True)

    def get_codigos_bncc(self, obj):
        return [obj.habilidade.codigo_bncc] if obj.habilidade else []

    class Meta:
        model = PlanoDeAula
        fields = [
            "uuid",
            "usuario",
            "nome",
            "componente",
            "ano",
            "habilidade",
            "competencias_gerais",
            "competencias_especificas",
            "metodologia",
            "avaliacao",
            "recursos_didaticos",
            "referencias_bibliograficas",
            "observacao",
            "plano_estruturado",
            "codigos_bncc",
            "ano_escolar",
            "componente_nome",
            "arquivado",
        ]
