from django.core.management.base import BaseCommand
from django.core.management import call_command


DISCIPLINAS = [
    "arte",
    "biologia",
    "ciencias",
    "educacao_fisica",
    "filosofia",
    "fisica",
    "geografia",
    "historia",
    "ingles",
    "matematica",
    "quimica",
    "sociologia",
]


class Command(BaseCommand):
    help = "Executa todos os comandos populabncc_<disciplina> na ordem definida em DISCIPLINAS."

    def handle(self, *args, **options):
        total = len(DISCIPLINAS)
        self.stdout.write(self.style.NOTICE(f"📚 Iniciando carga BNCC para {total} disciplinas…\n"))

        for i, disc in enumerate(DISCIPLINAS, start=1):
            cmd_name = f"populabncc_{disc}"
            self.stdout.write(self.style.NOTICE(f"[{i}/{total}] → {cmd_name}"))
            try:
                call_command(cmd_name)
            except Exception as exc:  # noqa: BLE001
                self.stderr.write(self.style.ERROR(f"❌ Erro em {cmd_name}: {exc}"))
                # opcional: continue  # ou raise para abortar tudo
            else:
                self.stdout.write(self.style.SUCCESS(f"✅ {cmd_name} concluído.\n"))

        self.stdout.write(self.style.SUCCESS("🎉 Importação BNCC finalizada!"))
