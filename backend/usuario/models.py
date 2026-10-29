from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.utils import timezone


class Funcionalidade(models.Model):
    nome = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)

    class Meta:
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class Perfil(models.Model):
    nome = models.CharField(max_length=100, unique=True)
    funcionalidades = models.ManyToManyField(
        Funcionalidade, related_name="perfis", blank=True
    )
    componentes = models.ManyToManyField(
        "conteudo.Componente", related_name="perfis", blank=True
    )

    class Meta:
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class UsuarioManager(BaseUserManager):
    def create_user(self, email, usuario=None, senha=None, **extra_fields):
        if not email:
            raise ValueError("O e-mail deve ser fornecido")
        email = self.normalize_email(email)
        user = self.model(email=email, usuario=usuario, **extra_fields)
        user.set_password(senha)
        user.save(using=self._db)
        return user


    def create_superuser(self, email, usuario, senha, **extra_fields):
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, usuario, senha, **extra_fields)


class Usuario(AbstractBaseUser):
    nome = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    usuario = models.CharField(max_length=50, unique=True, null=True, blank=True)
    telefone = models.CharField(max_length=20, null=True, blank=True)
    tipo_documento = models.CharField(
        max_length=4,
        choices=[("CPF", "CPF"), ("CNPJ", "CNPJ")],
        default="N/A",
    )
    documento = models.CharField(max_length=25, default="", blank=True)


    plano = models.CharField(max_length=32, null=True, blank=True)
    creditos = models.IntegerField(default=0)
    expira_em = models.DateTimeField(null=True, blank=True)
    ultimo_login = models.DateTimeField(null=True, blank=True)
    session_jti = models.CharField(max_length=255, null=True, blank=True)
    criado_em = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    perfil = models.ForeignKey(
        Perfil, on_delete=models.SET_NULL, null=True, blank=True, related_name="usuarios"
    )

    objects = UsuarioManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["documento", "telefone"]

    def __str__(self):
        return self.usuario

    class Meta:
        db_table = "usuario"
