from pathlib import Path
from django.conf import settings
from .populabncc_matematica import Command as BaseCommand


class Command(BaseCommand):
    ARQUIVOS_JSON = [
        "BNCC Ciências - 1° Ano.json",
        "BNCC Ciências - 2° Ano.json",
        "BNCC Ciências - 3° Ano.json",
        "BNCC Ciências - 4° Ano.json",
        "BNCC Ciências - 5° Ano.json",
        "BNCC Ciências - 6° Ano.json",
        "BNCC Ciências - 7° Ano.json",
        "BNCC Ciências - 8° Ano.json",
        "BNCC Ciências - 9° Ano.json",
    ]

    def handle(self, *args, **options):
        data_dir = Path(settings.BASE_DIR) / "conteudo" / "data" / "Ciências"
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
