from pathlib import Path
from django.conf import settings
from .populabncc_matematica import Command as BaseCommand


class Command(BaseCommand):
    ARQUIVOS_JSON = [
        "BNCC 1° Ano - Arte.json",
        "BNCC 1° Série - Arte.json",
        "BNCC 2° Ano - Arte.json",
        "BNCC 2° Série - Arte.json",
        "BNCC 3° Ano - Arte.json",
        "BNCC 3° Série - Arte.json",
        "BNCC 4° Ano - Arte.json",
        "BNCC 5° Ano - Arte.json",
        "BNCC 6° Ano - Arte.json",
        "BNCC 7° Ano - Arte.json",
        "BNCC 8° Ano - Arte.json",
        "BNCC 9° Ano - Arte.json",
    ]

    def handle(self, *args, **options):
        data_dir = Path(settings.BASE_DIR) / "conteudo" / "data" / "Arte"
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
