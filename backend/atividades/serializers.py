from rest_framework import serializers
from .models import Questao, Alternativa, ListaAtividade


class AlternativaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alternativa
        fields = ['id', 'letra', 'texto', 'correta', 'imagem']

class QuestaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Questao
        fields = [
            'uuid', 'enunciado', 'tipo', 'resposta_discursiva',
            'solucao', 'fonte', 'dificuldade',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.tipo == 'objetiva':
            alternativas = Alternativa.objects.filter(questao=instance)
            data['alternativas'] = AlternativaSerializer(alternativas, many=True).data
            data.pop('resposta_discursiva', None)
        else:
            data.pop('alternativas', None)
        return data

class ListaAtividadeSerializer(serializers.ModelSerializer):
    codigos_bncc = serializers.SerializerMethodField()
    componente = serializers.SerializerMethodField()
    ano = serializers.SerializerMethodField()
    tema_livre = serializers.CharField(read_only=True)

    class Meta:
        model = ListaAtividade
        fields = [
            'uuid','nome','status','quantidade_questoes','dificuldade',
            'codigos_bncc','componente','ano','tema_livre','criado_em',
        ]

    def get_codigos_bncc(self, obj):
        return list(obj.habilidades.values_list('codigo_bncc', flat=True))

    def get_componente(self, obj):
        if obj.componente:  # tema livre
            return obj.componente.nome
        h = obj.habilidades.first()
        return h.componente.nome if h and h.componente else None

    def get_ano(self, obj):
        if obj.ano:  # tema livre
            return f"{obj.ano.numero_ano}º – {obj.ano.nivel_ensino}"
        h = obj.habilidades.first()
        if h and h.ano:
            return f"{h.ano.numero_ano}º – {h.ano.nivel_ensino}"
        return None