from django.core.management.base import BaseCommand
from usuario.models import Funcionalidade, Perfil, Usuario


class Command(BaseCommand):
    help = "Cria a funcionalidade 'administrador' e opcionalmente associa a um usuário"

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            help='Email do usuário que receberá a funcionalidade de administrador',
            default=None,
        )
        parser.add_argument(
            '--usuario-id',
            type=int,
            help='ID do usuário que receberá a funcionalidade de administrador',
            default=None,
        )

    def handle(self, *args, **options):
        # Criar funcionalidade administrador
        funcionalidade, created = Funcionalidade.objects.get_or_create(
            nome="Administrador",
            slug="administrador"
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Funcionalidade "Administrador" criada com sucesso!'
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    f'⚠ Funcionalidade "Administrador" já existe no banco de dados.'
                )
            )

        # Associar a um usuário se fornecido
        email = options.get('email')
        usuario_id = options.get('usuario_id')

        if email or usuario_id:
            try:
                if email:
                    usuario = Usuario.objects.get(email=email)
                else:
                    usuario = Usuario.objects.get(id=usuario_id)

                # Garantir que o usuário tem perfil
                if not usuario.perfil:
                    perfil = Perfil.objects.create(nome=f"Perfil {usuario.id}")
                    usuario.perfil = perfil
                    usuario.save(update_fields=["perfil"])
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'✓ Perfil criado para o usuário {usuario.email}'
                        )
                    )

                # Adicionar funcionalidade ao perfil
                if funcionalidade not in usuario.perfil.funcionalidades.all():
                    usuario.perfil.funcionalidades.add(funcionalidade)
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'✓ Funcionalidade "Administrador" associada ao usuário {usuario.email} (ID: {usuario.id})'
                        )
                    )
                else:
                    self.stdout.write(
                        self.style.WARNING(
                            f'⚠ Usuário {usuario.email} já possui a funcionalidade "Administrador"'
                        )
                    )

            except Usuario.DoesNotExist:
                if email:
                    self.stdout.write(
                        self.style.ERROR(
                            f'✗ Usuário com email "{email}" não encontrado.'
                        )
                    )
                else:
                    self.stdout.write(
                        self.style.ERROR(
                            f'✗ Usuário com ID "{usuario_id}" não encontrado.'
                        )
                    )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    '\nFuncionalidade criada! Para associar a um usuário, use:'
                )
            )
            self.stdout.write(
                f'  python manage.py criar_funcionalidade_admin --email usuario@exemplo.com'
            )
            self.stdout.write(
                f'  ou'
            )
            self.stdout.write(
                f'  python manage.py criar_funcionalidade_admin --usuario-id 1'
            )

