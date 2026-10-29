from django.urls import path
from . import views

urlpatterns = [
    path('gerar-atividades-correcao-docx/', views.gerar_correcao_atividade_docx, name='gerar_correcao_atividade_docx'),
]
