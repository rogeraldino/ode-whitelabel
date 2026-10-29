# education-backend/atividades/urls.py
from django.urls import path
from atividades import views

urlpatterns = [
    # Aqui você definirá as rotas da sua API
    path('criar-lista/', views.criar_lista, name='criar_lista'),
    path('questoes/<uuid:uuid_lista>/', views.questoes_da_lista, name='questoes_da_lista'),
    path('questoes/atualizar/<uuid:id>/', views.atualizar_questao, name='atualizar_questao'),
    path('questoes/geral/', views.buscar_questoes_gerais, name='buscar_questoes_gerais'),
    path('minhas-listas/', views.minhas_listas, name='minhas-listas'),
    path('listas/deletar/<uuid:lista_uuid>/', views.deletar_lista, name='deletar_lista'),
    path('salvar-lista/', views.salvar_lista, name='salvar_lista'),
    path('listas/buscar/', views.buscar_listas, name='buscar_listas'),
    path('listas/arquivar/<uuid:lista_uuid>/', views.arquivar_lista, name='arquivar_lista'),
    path('listas/desarquivar/<uuid:lista_uuid>/', views.desarquivar_lista, name='desarquivar_lista'),
    path('lista-apagar/<uuid:lista_uuid>/', views.apagar_lista, name='apagar_lista'),
]
