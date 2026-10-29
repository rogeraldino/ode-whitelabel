from django.contrib.auth.backends import ModelBackend
from usuario.models import Usuario

class EmailOrUsernameModelBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        try:
            user = Usuario.objects.get(email=username)
        except Usuario.DoesNotExist:
            try:
                user = Usuario.objects.get(usuario=username)
            except Usuario.DoesNotExist:
                return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
