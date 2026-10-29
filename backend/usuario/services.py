import re
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from usuario.models import Usuario, Perfil
from conteudo.models import Componente

class UsuarioService:
    @staticmethod
    def criar_novo_usuario(
        nome,
        email,
        usuario,
        senha,
        plano=None,
        tipo_documento=None,
        documento=None,
        telefone=None,
        duracao_meses=0,
    ):
        expira_em = None
        if duracao_meses:
            expira_em = timezone.now() + relativedelta(months=duracao_meses)

        usuario_novo = Usuario.objects.create_user(
            nome=nome,
            email=email,
            usuario=usuario,
            senha=senha,
            plano=plano,
            tipo_documento=tipo_documento,
            documento=documento,
            telefone=telefone,
            criado_em=timezone.now(),
            is_active=True,
            expira_em=expira_em,
        )
        return usuario_novo

    @staticmethod
    def vincular_componentes_a_usuarios(componentes_slugs, usuarios_ids):
        """Associa uma lista de componentes a múltiplos usuários."""
        componentes = list(Componente.objects.filter(slug__in=componentes_slugs))
        usuarios = Usuario.objects.filter(id__in=usuarios_ids).select_related("perfil")
        for usuario in usuarios:
            perfil = usuario.perfil
            if perfil is None:
                perfil = Perfil.objects.create(nome=f"Perfil {usuario.id}")
                usuario.perfil = perfil
                usuario.save(update_fields=["perfil"])
            perfil.componentes.add(*componentes)

    @staticmethod
    def extrair_componente_do_produto(nome_produto: str) -> str:
        """
        Extrai o nome do componente curricular do nome do produto.
        Ex: "Assistente - Matemática 6° Ano à 3ª Série" -> "Matemática"
        """
        if not nome_produto:
            return None
        
        # Remove "Assistente - " do início se existir
        nome_limpo = nome_produto.strip()
        if nome_limpo.startswith("Assistente - "):
            nome_limpo = nome_limpo.replace("Assistente - ", "", 1).strip()
        
        # Extrai o primeiro nome (componente) antes de qualquer número ou ano
        # Ex: "Matemática 6° Ano" -> "Matemática"
        match = re.match(r'^([A-Za-záàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ\s]+)', nome_limpo)
        if match:
            componente = match.group(1).strip()
            return componente
        
        return None

    @staticmethod
    def buscar_componente_por_nome(nome_componente: str):
        """
        Busca um componente pelo nome exato. Não cria se não encontrar.
        Retorna o Componente ou None.
        """
        if not nome_componente:
            return None
        
        try:
            return Componente.objects.get(nome=nome_componente)
        except Componente.DoesNotExist:
            return None

    @staticmethod
    def estender_acesso_usuario(usuario: Usuario, meses: int):
        """
        Estende a data de expiração do usuário.
        - Se expira_em é None ou passado: define como agora + meses
        - Se expira_em é futuro: adiciona meses à data existente
        """
        if meses <= 0:
            return
        
        agora = timezone.now()
        
        if usuario.expira_em is None or usuario.expira_em < agora:
            # Usuário sem acesso ou acesso expirado: define nova data
            usuario.expira_em = agora + relativedelta(months=meses)
        else:
            # Usuário com acesso ativo: estende a data existente
            usuario.expira_em = usuario.expira_em + relativedelta(months=meses)
        
        usuario.save(update_fields=["expira_em"])
