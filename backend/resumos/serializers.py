from rest_framework import serializers

from .models import Resumo
from conteudo.models import Habilidade


class ResumoSerializer(serializers.ModelSerializer):
    usuario = serializers.HiddenField(default=serializers.CurrentUserDefault())
    habilidades = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Habilidade.objects.all(),
    )
    codigos_bncc = serializers.SerializerMethodField()

    def get_codigos_bncc(self, obj):
        return list(obj.habilidades.values_list("codigo_bncc", flat=True))

    class Meta:
        model = Resumo
        fields = [
            "uuid",
            "usuario",
            "nome_documento",
            "habilidades",
            "json_openai",
            "assunto",
            "codigos_bncc",
            "arquivado",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["uuid", "criado_em", "atualizado_em"]
