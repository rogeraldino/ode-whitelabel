# backend/atividades/models.py
from django.db import models
import uuid
from usuario.models import Usuario  # Importe SEU model de usuário
from conteudo.models import Componente, AnoEscolar, Habilidade


class ListaAtividade(models.Model):
    DIFICULDADE_CHOICES = [
        ('fácil', 'Fácil'),
        ('médio', 'Médio'),
        ('difícil', 'Difícil'),
    ]
    TIPOS_QUESTOES_CHOICES = [
        ('objetiva', 'Objetiva'),
        ('discursiva', 'Discursiva'),
        ('ambas', 'Ambas'),
    ]
    STATUS_CHOICES = [
        ('criada', 'Criada'),
        ('excluida', 'Excluída'),
        ('salva', 'Salva'),
    ]

    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)  # quem gerou a atividade
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    nome = models.CharField(max_length=128)  # nome da lista
    quantidade_questoes = models.IntegerField()  # quantidade de questões da lista
    dificuldade = models.CharField(max_length=10, choices=DIFICULDADE_CHOICES)  # nível de dificuldade da lista
    tipos_questoes = models.CharField(max_length=20, choices=TIPOS_QUESTOES_CHOICES)  # tipo de questões incluídas
    prompt = models.TextField()  # prompt usado para gerar as questões (via IA, por exemplo)
    tokens_gastos = models.IntegerField(default=0)  # quantidade de tokens usados na geração (útil para IA)
    criado_em = models.DateTimeField(auto_now_add=True)  # data e hora de criação da lista
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='criada')  # status da lista (rascunho ou salva)
    habilidades = models.ManyToManyField(Habilidade, related_name="listas", blank=True)  # habilidades (BNCC) associadas à lista
    questoes = models.ManyToManyField("Questao", related_name="listas", blank=True)
    tema_livre = models.CharField(max_length=200, blank=True, null=True)
    componente = models.ForeignKey(Componente, on_delete=models.SET_NULL, null=True, blank=True)
    ano = models.ForeignKey(AnoEscolar, on_delete=models.SET_NULL, null=True, blank=True)


    def __str__(self):
        return self.nome

class Questao(models.Model):
    DIFICULDADE_CHOICES = [
        ('fácil', 'Fácil'),
        ('médio', 'Médio'),
        ('difícil', 'Difícil'),
    ]
    
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    tipo = models.CharField(max_length=15)  # 'objetiva' ou 'discursiva'
    enunciado = models.TextField()
    resposta_discursiva = models.TextField(null=True, blank=True)
    imagem = models.CharField(max_length=255, null=True, blank=True)
    solucao = models.TextField(null=True, blank=True)
    peso_padrao = models.FloatField(default=1.0)
    habilidade = models.ForeignKey(Habilidade, on_delete=models.SET_NULL, null=True, blank=True)
    dificuldade = models.CharField(max_length=10, choices=DIFICULDADE_CHOICES, default='médio')  # nível de dificuldade da questão
    fonte = models.CharField(max_length=255, null=True, blank=True)  # <- nova coluna

    def __str__(self):
        return f"Questão ({self.tipo})"


class Alternativa(models.Model):
    questao = models.ForeignKey(Questao, on_delete=models.CASCADE)  # a qual questão esta alternativa pertence
    texto = models.CharField(max_length=255)  # texto da alternativa
    letra = models.CharField(max_length=1)  # letra identificadora (A, B, C, etc.)
    correta = models.BooleanField(default=False)  # indica se a alternativa é a correta
    imagem = models.CharField(max_length=255, null=True, blank=True)  # imagem complementar à alternativa, se houver

    def __str__(self):
        return f"Alternativa {self.letra} para {self.questao}"
