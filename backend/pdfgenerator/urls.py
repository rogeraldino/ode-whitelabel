# correcao/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('gerar-atividades-correcao/', views.gerar_correcao_atividade, name='gerar_correcao_atividade'),
    path('baixar-ultima/<uuid:lista_uuid>/', views.baixar_ultima_atividade, name='baixar_ultima_atividade'),
    path('baixar-solucoes-ultima/<uuid:lista_uuid>/', views.baixar_ultima_solucao, name='baixar_ultima_solucao'),
    path('respostas/<uuid:identificador_qr>/', views.respostas_modelo, name='respostas_modelo'),
    path('gerar-solucoes/', views.gerar_solucoes_atividade, name='gerar_solucoes_atividade'),
]