from django.core.management.base import BaseCommand
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from usuario.models import Funcionalidade, Usuario
from conteudo.models import Componente

FUNCIONALIDADES = [
    ("Gerar Resumo", "gerar-resumo"),
    ("Gerar Atividade", "gerar-atividade"),
    ("Gerar Plano de Aula", "gerar-plano-de-aula"),
    ("Baixar Mapa Mental", "baixar-mapa-mental"),
    ("Corrigir Atividade", "corrigir-atividade"),
    ("Administrador", "administrador"),
]

COMPONENTES = [
    ("Arte", "arte"),
    ("Biologia", "biologia"),
    ("Ciências", "ciencias"),
    ("Educação Física", "educacao-fisica"),
    ("Filosofia", "filosofia"),
    ("Física", "fisica"),
    ("Geografia", "geografia"),
    ("História", "historia"),
    ("Inglês", "ingles"),
    ("Matemática", "matematica"),
    ("Química", "quimica"),
    ("Sociologia", "sociologia"),
]


PLANOS_PARA_MESES = {
    "mensal": 1,
    "semestral": 6,
    "anual": 12,
}


class Command(BaseCommand):
    help = "Cadastra funcionalidades e componentes padrão para controle de acesso"

    def handle(self, *args, **options):
        for nome, slug in FUNCIONALIDADES:
            Funcionalidade.objects.get_or_create(nome=nome, slug=slug)
        for nome, slug in COMPONENTES:
            Componente.objects.get_or_create(nome=nome, slug=slug)
        for usuario in Usuario.objects.all():
            meses = PLANOS_PARA_MESES.get(usuario.plano)
            if meses:
                usuario.expira_em = timezone.now() + relativedelta(months=meses)
                usuario.save(update_fields=["expira_em"])
        self.stdout.write(self.style.SUCCESS("Funcionalidades e componentes cadastrados."))
