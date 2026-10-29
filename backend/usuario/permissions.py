from rest_framework.permissions import BasePermission


def perfil_perm(funcionalidade_slug: str):
    """
    Factory que gera uma classe de permissão baseada no slug da funcionalidade
    associada ao perfil do usuário.
    """
    class PerfilFuncionalidadePermission(BasePermission):
        """
        Permissão baseada nas funcionalidades associadas ao perfil do usuário.
        """

        def has_permission(self, request, view):
            perfil = getattr(request.user, "perfil", None)
            if perfil is None:
                return False
            return perfil.funcionalidades.filter(slug=funcionalidade_slug).exists()

    PerfilFuncionalidadePermission.__name__ = f"PerfilFuncionalidadePermission_{funcionalidade_slug}"
    return PerfilFuncionalidadePermission


class IsAdministradorPermission(BasePermission):
    """
    Permissão que verifica se o usuário tem a funcionalidade 'administrador'
    ou é staff/superuser.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Verifica se é staff/superuser (fallback)
        if getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False):
            return True
        
        # Verifica se tem funcionalidade administrador no perfil
        perfil = getattr(request.user, 'perfil', None)
        if perfil:
            return perfil.funcionalidades.filter(slug='administrador').exists()
        
        return False
