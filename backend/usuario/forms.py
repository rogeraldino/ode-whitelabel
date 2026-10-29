import logging
from django import forms
from usuario.models import Usuario

logger = logging.getLogger(__name__)

class UserCreationForm(forms.Form):
    nome = forms.CharField(max_length=150)
    email = forms.EmailField()
    telefone = forms.CharField(max_length=20, required=False)
    plano = forms.CharField(max_length=32, required=False)

    tipo_documento = forms.ChoiceField(choices=[('CPF', 'CPF'), ('CNPJ', 'CNPJ')])
    documento = forms.CharField(max_length=20)

    def clean_email(self):
        email = self.cleaned_data['email']
        if Usuario.objects.filter(email=email).exists():
            logger.warning("Tentativa de cadastro com e-mail já existente: %s", email)
            raise forms.ValidationError("Este email já está cadastrado.")
        return email
