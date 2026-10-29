from django.contrib import admin

from .models import Usuario, Funcionalidade, Perfil


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ("id", "email", "usuario", "perfil")


admin.site.register(Funcionalidade)
admin.site.register(Perfil)
