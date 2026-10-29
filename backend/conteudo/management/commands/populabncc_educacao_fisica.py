from pathlib import Path
from django.conf import settings
from .populabncc_matematica import Command as BaseCommand


class Command(BaseCommand):
    ARQUIVOS_JSON = [
        "BNCC Ed.Física - 1ª Série.json",
        "BNCC Ed.Física - 1° Ano.json",
        "BNCC Ed.Física - 2ª Série.json",
        "BNCC Ed.Física - 2° Ano.json",
        "BNCC Ed.Física - 3ª Série.json",
        "BNCC Ed.Física - 3° Ano.json",
        "BNCC Ed.Física - 4° Ano.json",
        "BNCC Ed.Física - 5° Ano.json",
        "BNCC Ed.Física - 6° Ano.json",
        "BNCC Ed.Física - 7° Ano.json",
        "BNCC Ed.Física - 8° Ano.json",
        "BNCC Ed.Física - 9° Ano.json",
    ]

    def handle(self, *args, **options):
        data_dir = Path(settings.BASE_DIR) / "conteudo" / "data" / "Educação Física"
        self._carregar_competencias(data_dir / self.ARQUIVO_COMPETENCIAS)
        self._carregar_metodologias(data_dir / self.ARQUIVO_METODOLOGIAS)
        for nome in self.ARQUIVOS_JSON:
            caminho = data_dir / nome
            if not caminho.exists():
                self.stdout.write(self.style.WARNING(f"⚠️  Arquivo não encontrado: {nome}"))
                continue
            self.stdout.write(self.style.NOTICE(f"\n📄 Processando: {nome}"))
            self._processar_habilidades(caminho)
        self.stdout.write(self.style.SUCCESS("\n✅ Importação concluída."))
