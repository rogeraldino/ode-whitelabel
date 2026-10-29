from pathlib import Path
from django.conf import settings
from .populabncc_matematica import Command as BaseCommand


class Command(BaseCommand):
    ARQUIVOS_JSON = [
        "BNCC Geografia - 1ª Série.json",
        "BNCC Geografia - 1° ano.json",
        "BNCC Geografia - 2ª Série.json",
        "BNCC Geografia - 2° ano.json",
        "BNCC Geografia - 3ª Série.json",
        "BNCC Geografia - 3° ano.json",
        "BNCC Geografia - 4° ano.json",
        "BNCC Geografia - 5° ano.json",
        "BNCC Geografia - 6° ano.json",
        "BNCC Geografia - 7° ano.json",
        "BNCC Geografia - 8° ano.json",
        "BNCC Geografia - 9° ano.json",
    ]

    def handle(self, *args, **options):
        data_dir = Path(settings.BASE_DIR) / "conteudo" / "data" / "Geografia"
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
